import { NextResponse } from "next/server";
import { origemValida } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resposta(corpo: object, status = 200) {
  return NextResponse.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(req: Request) {
  if (!origemValida(req)) return resposta({ error: "Pedido inválido." }, 400);

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return resposta({ error: "Inicia sessão." }, 401);
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "organizador" && perfil?.papel !== "admin") return resposta({ error: "Sem permissões." }, 403);

  let corpo: { edicaoId?: unknown; acao?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return resposta({ error: "Pedido inválido." }, 400);
  }
  const edicaoId = typeof corpo.edicaoId === "string" ? corpo.edicaoId : "";
  const acao = corpo.acao === "cancelar" || corpo.acao === "reativar" ? corpo.acao : null;
  if (!UUID.test(edicaoId) || !acao) return resposta({ error: "Pedido inválido." }, 400);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return resposta({ error: "Serviço indisponível." }, 503);

  // Confirma a posse antes de mexer (o admin pode gerir qualquer evento).
  const ehAdmin = perfil.papel === "admin";
  let consulta = supabase.from("edicoes").select("id,estado,verificada_em").eq("id", edicaoId);
  if (!ehAdmin) consulta = consulta.eq("criado_por", user.id);
  const { data: edicao } = await consulta.maybeSingle();
  if (!edicao) return resposta({ error: "Evento não encontrado." }, 404);

  if (acao === "cancelar" && edicao.estado === "cancelada") {
    return resposta({ error: "O evento já está cancelado." }, 409);
  }
  // Reativar só devolve ao estado publicado se já tinha sido aprovado antes;
  // caso contrário volta à fila de revisão (nunca se auto-publica).
  if (acao === "reativar" && edicao.estado !== "cancelada") {
    return resposta({ error: "O evento não está cancelado." }, 409);
  }
  const novoEstado = acao === "cancelar" ? "cancelada" : (edicao.verificada_em ? "confirmada" : "pendente");

  const patch = await fetch(
    `${url}/rest/v1/edicoes?id=eq.${encodeURIComponent(edicaoId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({ estado: novoEstado, updated_at: new Date().toISOString() }),
      cache: "no-store",
    },
  );
  if (!patch.ok) return resposta({ error: "Não foi possível atualizar o evento." }, 502);
  const linhas = await patch.json().catch(() => []);
  if (!Array.isArray(linhas) || linhas.length === 0) return resposta({ error: "Não foi possível atualizar o evento." }, 502);

  return resposta({ ok: true, estado: novoEstado });
}
