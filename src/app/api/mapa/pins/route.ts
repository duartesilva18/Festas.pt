import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return NextResponse.json({ pins: [] }, { headers: { "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
  const supabase = createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data } = await supabase.from("mapa_pins").select("tipo,imagem_url");
  return NextResponse.json({ pins: data ?? [] }, { headers: { "Cache-Control": "public, max-age=60", "X-Content-Type-Options": "nosniff" } });
}
