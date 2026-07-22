import { NextResponse } from "next/server";
import { origemValida } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resposta(corpo: object, status = 200) {
  return NextResponse.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

function texto(valor: unknown, limite: number) {
  return typeof valor === "string" ? valor.normalize("NFKC").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, limite) : "";
}

export async function PUT(req: Request) {
  if (!origemValida(req)) return resposta({ error: "Pedido inválido." }, 400);
  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (!Number.isFinite(tamanho) || tamanho > 560_000) return resposta({ error: "O rascunho é demasiado grande." }, 413);

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return resposta({ error: "Inicia sessão para guardar o evento." }, 401);
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "organizador" && perfil?.papel !== "admin") return resposta({ error: "A tua conta ainda não pode criar eventos." }, 403);

  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return resposta({ error: "Rascunho inválido." }, 400); }
  if (!corpo.dados || typeof corpo.dados !== "object" || Array.isArray(corpo.dados)) return resposta({ error: "Rascunho inválido." }, 400);
  const nome = texto(corpo.nome, 140) || "Evento sem título";
  const agora = new Date().toISOString();

  if (typeof corpo.id === "string" && UUID.test(corpo.id)) {
    const versao = Number(corpo.versao);
    if (!Number.isInteger(versao) || versao < 1) return resposta({ error: "Versão do rascunho inválida." }, 409);
    const { data, error } = await supabase.from("eventos_rascunho")
      .update({ nome, dados: corpo.dados, versao: versao + 1, updated_at: agora })
      .eq("id", corpo.id).eq("user_id", user.id).eq("versao", versao)
      .select("id,versao,updated_at").maybeSingle();
    if (error) return resposta({ error: "Não foi possível guardar o rascunho." }, 502);
    if (!data) return resposta({ error: "O rascunho foi alterado noutra janela. Atualiza a página." }, 409);
    return resposta({ rascunho: data });
  }

  const { data, error } = await supabase.from("eventos_rascunho")
    .insert({ user_id: user.id, nome, dados: corpo.dados, versao: 1, updated_at: agora })
    .select("id,versao,updated_at").single();
  if (error || !data) return resposta({ error: "Não foi possível criar o rascunho." }, 502);
  return resposta({ rascunho: data }, 201);
}
