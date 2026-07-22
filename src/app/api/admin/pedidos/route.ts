import { NextResponse } from "next/server";
import { validarAdmin } from "@/lib/admin";
import { origemValida } from "@/lib/http";

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
  const nota = typeof corpo.nota === "string" ? corpo.nota.trim().slice(0, 500) : "";
  if (!UUID.test(id) || !acao) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Moderação indisponível." }, { status: 503 });
  }

  const cabecalhos = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const resposta = await fetch(
    `${url}/rest/v1/pedidos_organizador?id=eq.${encodeURIComponent(id)}&estado=eq.pendente`,
    {
      method: "PATCH",
      headers: { ...cabecalhos, Prefer: "return=representation" },
      body: JSON.stringify({
        estado: acao === "aprovar" ? "aprovado" : "rejeitado",
        nota_admin: nota || null,
        moderado_em: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!resposta.ok) {
    return NextResponse.json({ error: "Não foi possível moderar o pedido." }, { status: 502 });
  }
  const linhas = await resposta.json().catch(() => []);
  if (!Array.isArray(linhas) || linhas.length === 0) {
    return NextResponse.json({ error: "O pedido já foi moderado." }, { status: 409 });
  }

  // Ao aprovar, promove o perfil a organizador — só se ainda for membro,
  // para nunca despromover um admin.
  if (acao === "aprovar") {
    const userId = linhas[0]?.user_id as string | undefined;
    if (userId && UUID.test(userId)) {
      await fetch(
        `${url}/rest/v1/perfis?id=eq.${encodeURIComponent(userId)}&papel=eq.membro`,
        {
          method: "PATCH",
          headers: cabecalhos,
          body: JSON.stringify({ papel: "organizador" }),
          cache: "no-store",
        },
      );
    }
  }

  return NextResponse.json({ ok: true });
}
