import { NextResponse } from "next/server";
import { fetchFestasGeoJSON } from "@/lib/eventos";

export const revalidate = 300;

export async function GET() {
  const geojson = await fetchFestasGeoJSON();
  return NextResponse.json(geojson, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  });
}
