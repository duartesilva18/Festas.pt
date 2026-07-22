import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { origemValida } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TIPOS = ["junta_freguesia", "camara_municipal", "comissao_festas", "associacao", "outro"];

function textoLimpo(valor: unknown, limite: number) {
  if (typeof valor !== "string") return "";
  return valor
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limite + 1);
}

export async function POST(req: Request) {
  if (!origemValida(req)) return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });

  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (!Number.isFinite(tamanho) || tamanho > 6144) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Inicia sessão para pedir verificação." }, { status: 401 });

  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel === "organizador" || perfil?.papel === "admin") {
    return NextResponse.json({ error: "A tua conta já está verificada." }, { status: 409 });
  }

  let corpo: Record<string, unknown>;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  // Honeypot: responde ok sem dar feedback útil a bots.
  if (typeof corpo.website === "string" && corpo.website) return NextResponse.json({ ok: true });

  const nomeEntidade = textoLimpo(corpo.nomeEntidade, 120);
  const tipoEntidade = typeof corpo.tipoEntidade === "string" ? corpo.tipoEntidade : "";
  const concelho = textoLimpo(corpo.concelho, 80);
  const contacto = textoLimpo(corpo.contacto, 120);
  const link = textoLimpo(corpo.link, 300);
  const justificacao = textoLimpo(corpo.justificacao, 1000);
  const tempoPreenchimento = typeof corpo.tempoPreenchimento === "number" ? corpo.tempoPreenchimento : 0;

  if (
    nomeEntidade.length < 2 || nomeEntidade.length > 120 ||
    !TIPOS.includes(tipoEntidade) ||
    concelho.length < 2 || concelho.length > 80 ||
    contacto.length < 5 || contacto.length > 120 ||
    (link.length > 0 && (!/^https?:\/\//i.test(link) || link.length > 300)) ||
    justificacao.length < 20 || justificacao.length > 1000 ||
    tempoPreenchimento < 1500 || tempoPreenchimento > 2 * 60 * 60 * 1000
  ) {
    return NextResponse.json({ error: "Confirma os campos do pedido." }, { status: 400 });
  }

  // O insert usa a sessão do utilizador: a RLS garante user_id = auth.uid().
  const { error } = await supabase.from("pedidos_organizador").insert({
    user_id: user.id,
    nome_entidade: nomeEntidade,
    tipo_entidade: tipoEntidade,
    concelho,
    contacto,
    link: link || null,
    justificacao,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Já tens um pedido em análise." }, { status: 409 });
    }
    return NextResponse.json({ error: "Não foi possível enviar o pedido. Tenta novamente." }, { status: 502 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
