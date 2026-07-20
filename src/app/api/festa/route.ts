import { NextResponse } from "next/server";
import { fetchFestaDetalhe } from "@/lib/festa-detalhe";

export const revalidate = 3600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const concelho = searchParams.get("concelho");
  const slug = searchParams.get("slug");
  if (!concelho || !slug) {
    return NextResponse.json({ error: "Parâmetros em falta" }, { status: 400 });
  }

  const festa = await fetchFestaDetalhe(concelho, slug);
  if (!festa) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

  return NextResponse.json(
    { descricao: festa.descricao, cartazUrl: festa.cartazUrl, fotos: festa.fotos },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200" } },
  );
}
