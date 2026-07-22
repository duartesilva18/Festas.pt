import { NextResponse } from "next/server";
import { contarPendentes } from "@/lib/pendentes";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sem sessão." }, { status: 401 });
  const { data: perfil } = await supabase.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "admin") return NextResponse.json({ error: "Sem permissões." }, { status: 403 });

  const pendentes = await contarPendentes();
  return NextResponse.json(pendentes, {
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
