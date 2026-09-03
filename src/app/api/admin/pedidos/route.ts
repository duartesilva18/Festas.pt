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

  // Aprovar é uma operação de três passos — marcar o pedido, criar a entidade
  // com a pessoa como dona, e promover o perfil. Feitos em chamadas separadas,
  // uma falha a meio deixava um organizador aprovado sem entidade nenhuma, que
  // é pior do que não o aprovar. Por isso vai tudo numa função atómica.
  if (acao === "aprovar") {
    const resposta = await fetch(`${url}/rest/v1/rpc/aprovar_pedido_organizador`, {
      method: "POST",
      headers: cabecalhos,
      body: JSON.stringify({ p_pedido_id: id, p_nota: nota || null }),
      cache: "no-store",
    });
    if (!resposta.ok) {
      const detalhe = await resposta.text();
      if (detalhe.includes("PEDIDO_NAO_PENDENTE")) {
        return NextResponse.json({ error: "O pedido já foi moderado." }, { status: 409 });
      }
      if (detalhe.includes("FESTA_JA_TEM_DONO")) {
        return NextResponse.json(
          { error: "Essa festa já tem uma entidade responsável — rejeita este pedido." },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: "Não foi possível aprovar o pedido." }, { status: 502 });
    }
    const entidadeId = await resposta.json().catch(() => null);
    return NextResponse.json({ ok: true, entidadeId });
  }

  // Rejeitar não cria nada, portanto continua a ser um PATCH simples. O filtro
  // por estado pendente impede reescrever uma decisão já tomada.
  const resposta = await fetch(
    `${url}/rest/v1/pedidos_organizador?id=eq.${encodeURIComponent(id)}&estado=eq.pendente`,
    {
      method: "PATCH",
      headers: { ...cabecalhos, Prefer: "return=representation" },
      body: JSON.stringify({
        estado: "rejeitado",
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

  return NextResponse.json({ ok: true });
}
