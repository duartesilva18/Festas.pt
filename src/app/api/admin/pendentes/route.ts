import { NextResponse } from "next/server";
import { ehAdmin } from "@/lib/admin";
import { contarPendentes } from "@/lib/pendentes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  // A Navbar chama isto em cada página de admin. Contar em paralelo com o
  // portão poupa um round-trip: as contagens usam a service key e são
  // descartadas aqui se o portão fechar.
  const [admin, pendentes] = await Promise.all([ehAdmin(), contarPendentes()]);
  if (!admin) return NextResponse.json({ error: "Sem permissões." }, { status: 403 });

  return NextResponse.json(pendentes, {
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
