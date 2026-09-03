import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Só caminhos internos: "/perfil" serve, "//evil.com" e "@evil.com" não.
// Sem isto, `origin + next` deixa o atacante trocar o host pela parte userinfo
// do URL ("https://achafestas.com@evil.com" aponta para evil.com).
function destinoSeguro(bruto: string | null) {
  if (!bruto || !bruto.startsWith("/") || bruto.startsWith("//") || bruto.startsWith("/\\")) return "/";
  return bruto;
}

// Recebe o retorno do Google, troca o código por sessão e volta à app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const destino = destinoSeguro(searchParams.get("next"));

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destino, origin));
  }

  return NextResponse.redirect(new URL("/?auth=erro", origin));
}
