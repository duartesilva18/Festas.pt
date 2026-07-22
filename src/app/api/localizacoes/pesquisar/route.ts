import { type NextRequest, NextResponse } from "next/server";
import { dentroDoLimite, identificarPedido } from "@/lib/limites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ResultadoNominatim = {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  lat?: string;
  lon?: string;
  name?: string;
  display_name?: string;
  type?: string;
  addresstype?: string;
  boundingbox?: string[];
  address?: Record<string, string | undefined>;
};

type ResultadoLocalidade = {
  id: string;
  nome: string;
  descricao: string;
  tipo: string;
  lat: number;
  lng: number;
  limites: [number, number, number, number] | null;
};

const TIPOS_PERMITIDOS = new Set([
  "city",
  "town",
  "village",
  "municipality",
  "county",
  "state_district",
  "administrative",
  "suburb",
  "quarter",
  "hamlet",
  "locality",
]);
const NOMES_TIPO: Record<string, string> = {
  city: "Cidade",
  town: "Vila",
  village: "Localidade",
  municipality: "Município",
  county: "Concelho",
  state_district: "Distrito",
  administrative: "Zona administrativa",
  suburb: "Zona",
  quarter: "Bairro",
  hamlet: "Lugar",
  locality: "Localidade",
};
const cacheMemoria = new Map<string, { expiraEm: number; resultados: ResultadoLocalidade[] }>();
const JANELA_S = 60;
const MAXIMO_POR_JANELA = 20;
let ultimoPedidoExterno = 0;
let filaExterna: Promise<void> = Promise.resolve();

function resposta(corpo: object, estado = 200) {
  return NextResponse.json(corpo, {
    status: estado,
    headers: {
      "Cache-Control": estado === 200 ? "public, max-age=3600, stale-while-revalidate=604800" : "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function executarComLimite<T>(tarefa: () => Promise<T>): Promise<T> {
  const anterior = filaExterna;
  let libertar = () => {};
  filaExterna = new Promise<void>((resolve) => { libertar = resolve; });
  await anterior;
  try {
    const espera = Math.max(0, 1_050 - (Date.now() - ultimoPedidoExterno));
    if (espera > 0) await new Promise((resolve) => setTimeout(resolve, espera));
    ultimoPedidoExterno = Date.now();
    return await tarefa();
  } finally {
    libertar();
  }
}

function textoSeguro(valor: unknown, maximo: number) {
  return typeof valor === "string" ? valor.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximo) : "";
}

function normalizarResultado(item: ResultadoNominatim): ResultadoLocalidade | null {
  const lat = Number(item.lat);
  const lng = Number(item.lon);
  const tipoOriginal = textoSeguro(item.addresstype || item.type, 40).toLowerCase();
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat < 36.8 || lat > 42.3 || lng < -9.7 || lng > -6.0 || !TIPOS_PERMITIDOS.has(tipoOriginal)) return null;

  const nome = textoSeguro(
    item.name || item.address?.city || item.address?.town || item.address?.village || item.address?.municipality || item.address?.county,
    100,
  );
  if (!nome) return null;
  const partesDescricao = textoSeguro(item.display_name, 320)
    .split(",")
    .map((parte) => parte.trim())
    .filter((parte) => parte && parte.toLocaleLowerCase("pt-PT") !== nome.toLocaleLowerCase("pt-PT") && parte.toLocaleLowerCase("pt-PT") !== "portugal")
    .slice(0, 3);
  const caixa = Array.isArray(item.boundingbox) ? item.boundingbox.map(Number) : [];
  const limites = caixa.length === 4 && caixa.every(Number.isFinite)
    ? [caixa[0], caixa[1], caixa[2], caixa[3]] as [number, number, number, number]
    : null;

  return {
    id: `${textoSeguro(item.osm_type, 8)}-${String(item.osm_id ?? item.place_id ?? `${lat}-${lng}`)}`,
    nome,
    descricao: partesDescricao.join(" · ") || "Portugal",
    tipo: NOMES_TIPO[tipoOriginal] ?? "Localidade",
    lat,
    lng,
    limites,
  };
}

export async function GET(req: NextRequest) {
  const consulta = textoSeguro(req.nextUrl.searchParams.get("q"), 80);
  if (consulta.length < 2) return resposta({ resultados: [] });
  if (!(await dentroDoLimite(`pesquisa:${identificarPedido(req)}`, MAXIMO_POR_JANELA, JANELA_S))) return resposta({ error: "Demasiadas pesquisas. Aguarda um momento." }, 429);

  const chave = consulta.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-PT");
  const emCache = cacheMemoria.get(chave);
  if (emCache && emCache.expiraEm > Date.now()) return resposta({ resultados: emCache.resultados });

  const base = process.env.GEOCODING_BASE_URL ?? "https://nominatim.openstreetmap.org";
  let endpoint: URL;
  try {
    endpoint = new URL("search", base.endsWith("/") ? base : `${base}/`);
  } catch {
    return resposta({ error: "Pesquisa de localidades indisponível." }, 503);
  }
  endpoint.searchParams.set("q", consulta);
  endpoint.searchParams.set("format", "jsonv2");
  endpoint.searchParams.set("countrycodes", "pt");
  endpoint.searchParams.set("addressdetails", "1");
  endpoint.searchParams.set("accept-language", "pt");
  endpoint.searchParams.set("layer", "address");
  endpoint.searchParams.set("limit", "8");

  try {
    const respostaExterna = await executarComLimite(() => fetch(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": process.env.GEOCODING_USER_AGENT ?? "Achafestas/0.1 (+https://achafestas.pt)",
        Referer: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      },
      next: { revalidate: 604_800 },
      signal: AbortSignal.timeout(7_000),
    }));
    if (!respostaExterna.ok) return resposta({ error: "A pesquisa de localidades não respondeu." }, 502);
    const dados = await respostaExterna.json() as unknown;
    const resultados = Array.isArray(dados)
      ? dados.map((item) => normalizarResultado(item as ResultadoNominatim)).filter((item): item is ResultadoLocalidade => item !== null).slice(0, 6)
      : [];
    cacheMemoria.set(chave, { expiraEm: Date.now() + 15 * 60_000, resultados });
    if (cacheMemoria.size > 200) cacheMemoria.delete(cacheMemoria.keys().next().value ?? chave);
    return resposta({ resultados });
  } catch {
    return resposta({ error: "Não foi possível pesquisar agora. Tenta novamente." }, 502);
  }
}
