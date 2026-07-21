import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

// Recebe o retorno do Google, troca o código por sessão e volta à app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const destino = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${destino}`);
  }

  return NextResponse.redirect(`${origin}/?auth=erro`);
}
