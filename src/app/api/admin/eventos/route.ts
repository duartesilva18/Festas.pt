import { NextResponse } from "next/server";
import { validarAdmin } from "@/lib/admin";
import { origemValida } from "@/lib/http";
import { emailEventoAprovado, emailEventoRejeitado } from "@/lib/email";
import { perfilNotificavel } from "@/lib/notificar";
import { revalidarEvento } from "@/lib/revalidar";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: Request) {
  if (!origemValida(req)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  const admin = await validarAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissões." }, { status: 403 });

  let corpo: { id?: unknown; acao?: unknown; nota?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const id = typeof corpo.id === "string" ? corpo.id : "";
  const acao = corpo.acao === "aprovar" || corpo.acao === "rejeitar" ? corpo.acao : null;
  const nota = typeof corpo.nota === "string"
    ? corpo.nota.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500)
    : "";
  if (!UUID.test(id) || !acao) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Moderação indisponível." }, { status: 503 });
  }

  // Só atua sobre edições ainda pendentes: evita reescrever decisões já tomadas.
  const resposta = await fetch(
    `${url}/rest/v1/edicoes?id=eq.${encodeURIComponent(id)}&estado=eq.pendente`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        estado: acao === "aprovar" ? "confirmada" : "cancelada",
        nota_moderacao: nota || null,
        verificada_em: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!resposta.ok) {
    return NextResponse.json({ error: "Não foi possível moderar o evento." }, { status: 502 });
  }
  const linhas = await resposta.json().catch(() => []);
  if (!Array.isArray(linhas) || linhas.length === 0) {
    return NextResponse.json({ error: "O evento já foi moderado." }, { status: 409 });
  }

  // A decisão tem de chegar ao público sem esperar pela expiração da cache.
  const festaId = linhas[0]?.festa_id;
  let concelhoSlug: string | undefined;
  let festaSlug: string | undefined;
  let nomeEvento = "O teu evento";
  if (festaId) {
    const dados = await fetch(
      `${url}/rest/v1/festas?id=eq.${encodeURIComponent(festaId)}&select=nome,slug,concelhos(slug)`,
      { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store" },
    ).then((r) => (r.ok ? r.json() : [])).catch(() => []);
    festaSlug = dados?.[0]?.slug;
    concelhoSlug = dados?.[0]?.concelhos?.slug;
    if (dados?.[0]?.nome) nomeEvento = dados[0].nome;
  }
  revalidarEvento(concelhoSlug, festaSlug);

  // Avisar o organizador da decisão. Falhar aqui não invalida a moderação.
  const organizador = await perfilNotificavel(url, serviceKey, linhas[0]?.criado_por);
  if (organizador) {
    if (acao === "aprovar" && concelhoSlug && festaSlug) {
      await emailEventoAprovado(organizador, nomeEvento, `/festas/${concelhoSlug}/${festaSlug}`);
    } else if (acao === "rejeitar") {
      await emailEventoRejeitado(organizador, nomeEvento, nota || null);
    }
  }

  return NextResponse.json({ ok: true });
}
