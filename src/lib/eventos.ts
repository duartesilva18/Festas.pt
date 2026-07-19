export type EstadoTemporal = "a_decorrer" | "em_breve" | "futuro";

export type FestaMapa = {
  id: string;
  slug: string;
  nome: string;
  freguesia: string | null;
  categorias: string[];
  concelho: string;
  concelho_slug: string;
  distrito: string;
  lng: number;
  lat: number;
  ano: number;
  data_inicio: string;
  data_fim: string | null;
  estado: string;
  cartaz_url: string | null;
};

export type FestaFeature = GeoJSON.Feature<
  GeoJSON.Point,
  Omit<FestaMapa, "lng" | "lat"> & { estado_temporal: EstadoTemporal }
>;

export type FestasGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  FestaFeature["properties"]
>;

function estadoTemporal(inicio: string, fim: string | null, hoje: Date): EstadoTemporal {
  const dInicio = new Date(inicio + "T00:00:00");
  const dFim = new Date((fim ?? inicio) + "T23:59:59");
  if (dInicio <= hoje && hoje <= dFim) return "a_decorrer";
  const seteDias = new Date(hoje);
  seteDias.setDate(seteDias.getDate() + 7);
  if (dInicio <= seteDias) return "em_breve";
  return "futuro";
}

export async function fetchFestasGeoJSON(): Promise<FestasGeoJSON> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Variáveis NEXT_PUBLIC_SUPABASE_* em falta");

  const res = await fetch(`${url}/rest/v1/festas_mapa?select=*&order=data_inicio`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Supabase respondeu ${res.status}`);

  const rows: FestaMapa[] = await res.json();
  const hoje = new Date();

  return {
    type: "FeatureCollection",
    features: rows.map((r) => {
      const { lng, lat, ...props } = r;
      return {
        type: "Feature",
        geometry: { type: "Point", coordinates: [lng, lat] },
        properties: {
          ...props,
          estado_temporal: estadoTemporal(r.data_inicio, r.data_fim, hoje),
        },
      };
    }),
  };
}
