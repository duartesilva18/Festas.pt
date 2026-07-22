export type EstadoTemporal = "a_decorrer" | "em_breve" | "futuro";

export type FestaMapa = {
  id: string;
  slug: string;
  nome: string;
  freguesia: string | null;
  categorias: string[];
  categoria_principal: string;
  formato_evento: string | null;
  tags_evento: string[];
  tipo_recorrencia: "anual" | "unica" | "fins_de_semana";
  padrao_recorrencia: "continuo" | "fins_de_semana";
  dias_semana: number[];
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
  media_criticas: number | null;
  total_criticas: number;
};

export type FestaFeature = GeoJSON.Feature<
  GeoJSON.Point,
  Omit<FestaMapa, "lng" | "lat"> & { estado_temporal: EstadoTemporal }
>;

export type FestasGeoJSON = GeoJSON.FeatureCollection<
  GeoJSON.Point,
  FestaFeature["properties"]
>;

export function estadoTemporal(
  inicio: string,
  fim: string | null,
  hoje: Date,
  tipoRecorrencia: string = "unica",
  diasSemana: number[] = [],
): EstadoTemporal {
  const dInicio = new Date(inicio + "T00:00:00");
  const dFim = new Date((fim ?? inicio) + "T23:59:59");
  if (tipoRecorrencia === "fins_de_semana" && fim && diasSemana.length > 0) {
    const diaAtual = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12);
    const inicioLocal = new Date(inicio + "T12:00:00");
    const fimLocal = new Date(fim + "T12:00:00");
    if (diaAtual >= inicioLocal && diaAtual <= fimLocal && diasSemana.includes(diaAtual.getDay() || 7)) return "a_decorrer";

    const proxima = new Date(Math.max(diaAtual.getTime(), inicioLocal.getTime()));
    if (proxima <= diaAtual) proxima.setDate(proxima.getDate() + 1);
    for (let i = 0; i < 7 && proxima <= fimLocal; i += 1) {
      if (diasSemana.includes(proxima.getDay() || 7)) {
        const seteDias = new Date(diaAtual);
        seteDias.setDate(seteDias.getDate() + 7);
        return proxima <= seteDias ? "em_breve" : "futuro";
      }
      proxima.setDate(proxima.getDate() + 1);
    }
    return "futuro";
  }
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

  const campos = "id,slug,nome,freguesia,categorias,concelho,concelho_slug,distrito,lng,lat,ano,data_inicio,data_fim,estado,cartaz_url,media_criticas,total_criticas,categoria_principal,formato_evento,tags_evento,tipo_recorrencia,padrao_recorrencia,dias_semana";
  const res = await fetch(`${url}/rest/v1/festas_mapa?select=${campos}&order=data_inicio`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 300, tags: ["festas"] },
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
          estado_temporal: estadoTemporal(r.data_inicio, r.data_fim, hoje, r.tipo_recorrencia, r.dias_semana),
        },
      };
    }),
  };
}
