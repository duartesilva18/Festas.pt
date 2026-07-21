import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Confirma no servidor que quem chama tem sessão válida e papel de admin.
async function validarAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  return perfil?.papel === "admin" ? user : null;
}

export async function POST(req: Request) {
  const admin = await validarAdmin();
  if (!admin) return NextResponse.json({ error: "Sem permissões." }, { status: 403 });

  let corpo: { id?: unknown; acao?: unknown };
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const id = typeof corpo.id === "string" ? corpo.id : "";
  const acao = corpo.acao === "aprovar" || corpo.acao === "rejeitar" ? corpo.acao : null;
  if (!UUID.test(id) || !acao) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: "Moderação indisponível." }, { status: 503 });
  }

  const resposta = await fetch(
    `${url}/rest/v1/criticas?id=eq.${encodeURIComponent(id)}&estado=eq.pendente`,
    {
      method: "PATCH",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        estado: acao === "aprovar" ? "aprovada" : "rejeitada",
        moderada_em: new Date().toISOString(),
      }),
      cache: "no-store",
    },
  );

  if (!resposta.ok) {
    return NextResponse.json({ error: "Não foi possível moderar a crítica." }, { status: 502 });
  }
  const linhas = await resposta.json().catch(() => []);
  if (!Array.isArray(linhas) || linhas.length === 0) {
    return NextResponse.json({ error: "A crítica já foi moderada." }, { status: 409 });
  }

  return NextResponse.json({ ok: true });
}
