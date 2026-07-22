import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Estado atual do pedido de organizador — usado para detetar a aprovação sem F5. */
export async function GET() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sem sessão." }, { status: 401 });

  const [{ data: perfil }, { data: pedido }] = await Promise.all([
    supabase.from("perfis").select("papel").eq("id", user.id).single(),
    supabase.from("pedidos_organizador").select("id,estado").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  return NextResponse.json(
    { papel: perfil?.papel ?? "membro", pedidoId: pedido?.id ?? null, pedidoEstado: pedido?.estado ?? null },
    { headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } },
  );
}
