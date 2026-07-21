import { NextResponse } from "next/server";
import { fetchFestaDetalhe } from "@/lib/festa-detalhe";

export const dynamic = "force-dynamic";
const IDENTIFICADOR = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const concelho = searchParams.get("concelho");
  const slug = searchParams.get("slug");
  if (!concelho || !slug || concelho.length > 80 || slug.length > 120 || !IDENTIFICADOR.test(concelho) || !IDENTIFICADOR.test(slug)) {
    return NextResponse.json({ error: "Parâmetros em falta" }, { status: 400 });
  }

  try {
    const festa = await fetchFestaDetalhe(concelho, slug);
    if (!festa) return NextResponse.json({ error: "Não encontrada" }, { status: 404 });

    return NextResponse.json(
      {
        descricao: festa.descricao,
        cartazUrl: festa.cartazUrl,
        fotos: festa.fotos,
        programa: festa.programa,
        subLocalizacoes: festa.subLocalizacoes,
      },
      { headers: { "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate" } },
    );
  } catch {
    return NextResponse.json({ error: "Detalhe indisponível" }, { status: 503 });
  }
}
