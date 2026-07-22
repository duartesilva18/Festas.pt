import { cache } from "react";
import { estadoTemporal, type EstadoTemporal } from "@/lib/eventos";

export type ProgramaDia = { dia: string; eventos: { hora?: string; titulo: string }[] };
export type SubLocalizacao = {
  id: string;
  nome: string;
  tipo: "estacionamento" | "entrada" | "palco" | "after" | "bar" | "wc" | "primeiros_socorros" | "outro";
  descricao: string | null;
  lat: number;
  lng: number;
};

export type FestaDetalhe = {
  nome: string;
  slug: string;
  freguesia: string | null;
  descricao: string | null;
  categorias: string[];
  categoriaPrincipal: string;
  formatoEvento: string | null;
  tagsEvento: string[];
  tipoRecorrencia: "anual" | "unica" | "fins_de_semana";
  diasSemana: number[];
  concelho: string;
  concelhoSlug: string;
  distrito: string;
  lng: number | null;
  lat: number | null;
  ano: number;
  dataInicio: string;
  dataFim: string | null;
  estado: string;
  estadoTemporal: EstadoTemporal;
  programa: ProgramaDia[] | null;
  cartazUrl: string | null;
  fotos: string[];
  caracteristicas: string[];
  fonteUrl: string | null;
  subLocalizacoes: SubLocalizacao[];
};

// A localização PostGIS chega da API REST como EWKB hexadecimal.
function parseEWKBPoint(hex: string | null): [number, number] | null {
  if (!hex || hex.length < 42 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  const view = new DataView(bytes.buffer);
  const le = bytes[0] === 1;
  const type = view.getUint32(1, le);
  const temSrid = (type & 0x20000000) !== 0;
  const offset = 5 + (temSrid ? 4 : 0);
  if (bytes.byteLength < offset + 16) return null;
  const lng = view.getFloat64(offset, le);
  const lat = view.getFloat64(offset + 8, le);
  return Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lng) <= 180 && Math.abs(lat) <= 90
    ? [lng, lat]
    : null;
}

type LinhaEdicao = {
  ano: number;
  data_inicio: string;
  data_fim: string | null;
  estado: string;
  programa: ProgramaDia[] | null;
  cartaz_url: string | null;
  fotos: string[] | null;
  caracteristicas: string[] | null;
  fonte_url: string | null;
  padrao_recorrencia: "continuo" | "fins_de_semana";
  dias_semana: number[] | null;
  edicoes_sublocalizacoes: { id: string; nome: string; tipo: SubLocalizacao["tipo"]; descricao: string | null; location: string; estado: "rascunho" | "confirmada" | "rejeitada"; visivel: boolean }[] | null;
};

// Escolhe a edição mais relevante: a próxima confirmada; senão a mais recente.
function escolherEdicao(edicoes: LinhaEdicao[]): LinhaEdicao | null {
  if (!edicoes?.length) return null;
  const hoje = new Date().toISOString().slice(0, 10);
  const confirmadas = edicoes.filter((e) => e.estado === "confirmada");
  const futuras = confirmadas
    .filter((e) => (e.data_fim ?? e.data_inicio) >= hoje)
    .sort((a, b) => a.data_inicio.localeCompare(b.data_inicio));
  if (futuras.length) return futuras[0];
  const passadas = [...confirmadas].sort((a, b) => b.data_inicio.localeCompare(a.data_inicio));
  return passadas[0] ?? null;
}

export const fetchFestaDetalhe = cache(async function fetchFestaDetalhe(
  concelho: string,
  slug: string,
): Promise<FestaDetalhe | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Variáveis NEXT_PUBLIC_SUPABASE_* em falta");

  const select =
    "nome,slug,freguesia,descricao,categorias,categoria_principal,formato_evento,tags_evento,tipo_recorrencia,location," +
    "concelhos!inner(nome,slug,distrito)," +
    "edicoes(ano,data_inicio,data_fim,estado,programa,cartaz_url,fotos,caracteristicas,fonte_url,padrao_recorrencia,dias_semana,edicoes_sublocalizacoes(id,nome,tipo,descricao,location,ordem,estado,visivel))";
  const query =
    `${url}/rest/v1/festas?slug=eq.${encodeURIComponent(slug)}` +
    `&concelhos.slug=eq.${encodeURIComponent(concelho)}` +
    `&select=${encodeURIComponent(select)}`;

  const res = await fetch(query, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    next: { revalidate: 3600, tags: ["festas", `festa:${concelho}/${slug}`] },
  });
  if (!res.ok) throw new Error(`Supabase respondeu ${res.status}`);

  const linhas = await res.json();
  const f = linhas?.[0];
  if (!f) return null;

  const edicao = escolherEdicao(Array.isArray(f.edicoes) ? f.edicoes : []);
  if (!edicao) return null;

  const ponto = parseEWKBPoint(f.location);

  return {
    nome: f.nome,
    slug: f.slug,
    freguesia: f.freguesia,
    descricao: f.descricao,
    categorias: Array.isArray(f.categorias) ? f.categorias : [],
    categoriaPrincipal: typeof f.categoria_principal === "string" ? f.categoria_principal : "festa_popular",
    formatoEvento: typeof f.formato_evento === "string" ? f.formato_evento : null,
    tagsEvento: Array.isArray(f.tags_evento) ? f.tags_evento.filter((tag: unknown): tag is string => typeof tag === "string") : [],
    tipoRecorrencia: f.tipo_recorrencia === "fins_de_semana" || f.tipo_recorrencia === "unica" ? f.tipo_recorrencia : "anual",
    diasSemana: Array.isArray(edicao.dias_semana) ? edicao.dias_semana.filter((dia): dia is number => typeof dia === "number") : [],
    concelho: f.concelhos.nome,
    concelhoSlug: f.concelhos.slug,
    distrito: f.concelhos.distrito,
    lng: ponto?.[0] ?? null,
    lat: ponto?.[1] ?? null,
    ano: edicao.ano,
    dataInicio: edicao.data_inicio,
    dataFim: edicao.data_fim,
    estado: edicao.estado,
    estadoTemporal: estadoTemporal(edicao.data_inicio, edicao.data_fim, new Date(), f.tipo_recorrencia, edicao.dias_semana ?? []),
    programa: edicao.programa,
    cartazUrl: edicao.cartaz_url,
    fotos: Array.isArray(edicao.fotos) ? edicao.fotos : [],
    caracteristicas: Array.isArray(edicao.caracteristicas)
      ? edicao.caracteristicas.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
      : [],
    fonteUrl: edicao.fonte_url,
    subLocalizacoes: (edicao.edicoes_sublocalizacoes ?? [])
      .filter((local) => local.estado === "confirmada" && local.visivel)
      .map((local) => {
        const ponto = parseEWKBPoint(local.location);
        return ponto ? { id: local.id, nome: local.nome, tipo: local.tipo, descricao: local.descricao, lng: ponto[0], lat: ponto[1] } : null;
      })
      .filter((local): local is SubLocalizacao => local !== null),
  };
});
