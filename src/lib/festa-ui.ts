import type { EstadoTemporal, FestaFeature } from "@/lib/eventos";

// Paleta da marca (ancorada no logo): rosa-vermelho primário, laranja
// secundário, azul-noite reservado a texto. Estados: quente → neutro.
export const CORES: Record<EstadoTemporal, string> = {
  a_decorrer: "#EC2456",
  em_breve: "#F97B16",
  futuro: "#8B93A7",
};

export const ETIQUETAS: Record<EstadoTemporal, string> = {
  a_decorrer: "A decorrer",
  em_breve: "Muito em breve",
  futuro: "Mais tarde",
};

export type FestaSelecionada = {
  props: FestaFeature["properties"];
  lngLat: [number, number];
};

export type Coords = { lat: number; lng: number };

function chaveLocalizacao(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-PT");
}

export function formatarLocalizacao(...partes: (string | null | undefined)[]): string {
  const vistas = new Set<string>();
  return partes.flatMap((parte) => {
    const valor = parte?.trim();
    if (!valor) return [];
    const chave = chaveLocalizacao(valor);
    if (vistas.has(chave)) return [];
    vistas.add(chave);
    return [valor];
  }).join(" · ");
}

function dataLocal(valor: string) {
  const data = new Date(`${valor}T12:00:00`);
  return Number.isNaN(data.getTime()) ? null : data;
}

export function resumoDatas(
  inicio: string,
  fim: string | null,
  tipoRecorrencia: string = "unica",
  diasSemana: number[] = [],
  hoje = new Date(),
): { principal: string; secundario: string | null } {
  if (tipoRecorrencia !== "fins_de_semana" || !fim) {
    return { principal: formatarDatas(inicio, fim, tipoRecorrencia, diasSemana), secundario: null };
  }

  const primeiroDia = dataLocal(inicio);
  const ultimoDia = dataLocal(fim);
  if (!primeiroDia || !ultimoDia) return { principal: formatarDatas(inicio, fim, tipoRecorrencia, diasSemana), secundario: null };
  const permitidos = new Set(diasSemana.length ? diasSemana : [6, 7]);
  const cursor = new Date(Math.max(primeiroDia.getTime(), new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 12).getTime()));
  let proxima: Date | null = null;
  while (cursor <= ultimoDia) {
    const iso = cursor.getDay() || 7;
    if (permitidos.has(iso)) { proxima = new Date(cursor); break; }
    cursor.setDate(cursor.getDate() + 1);
  }
  const dia = new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" });
  return {
    principal: proxima ? `Próximo: ${dia.format(proxima)}` : `Até ${dia.format(ultimoDia)}`,
    secundario: formatarDatas(inicio, fim, tipoRecorrencia, diasSemana),
  };
}

export function formatarDiaPrograma(valor: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return valor;
  const data = dataLocal(valor);
  return data ? new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "numeric", month: "long" }).format(data) : valor;
}

// Distância em linha reta (Haversine), em km.
export function distanciaKm(a: Coords, b: Coords): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function formatarKm(km: number): string {
  return km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}

// Estimativa grosseira de trajeto de carro: fator de estrada 1.2× e ~95 km/h
// (calibrado para autoestrada; ex.: Lisboa→Viana ≈ 4h, real ≈ 3h50).
export function estimativaTempo(km: number): string {
  const minutos = Math.round(((km * 1.2) / 95) * 60);
  if (minutos < 60) return `~${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m ? `~${h}h${String(m).padStart(2, "0")}` : `~${h}h`;
}

export function formatarDatas(
  inicio: string,
  fim: string | null,
  tipoRecorrencia: string = "unica",
  diasSemana: number[] = [],
): string {
  const fmt = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" });
  const dInicio = new Date(inicio + "T12:00:00");
  if (tipoRecorrencia === "fins_de_semana" && fim) {
    const dFimRecorrencia = new Date(fim + "T12:00:00");
    const dias = [...new Set(diasSemana.length ? diasSemana : [6, 7])].sort();
    const prefixo = dias.length === 2 && dias[0] === 6 && dias[1] === 7
      ? "Todos os fins de semana"
      : dias.length === 3 && dias[0] === 5 && dias[1] === 6 && dias[2] === 7
        ? "Sextas, sábados e domingos"
        : `Semanalmente (${dias.map((dia) => ({ 5: "sexta", 6: "sábado", 7: "domingo" })[dia as 5 | 6 | 7]).filter(Boolean).join(", ")})`;
    return `${prefixo} até ${fmt.format(dFimRecorrencia)}`;
  }
  if (!fim || fim === inicio) return fmt.format(dInicio);
  const dFim = new Date(fim + "T12:00:00");
  if (dInicio.getMonth() === dFim.getMonth()) {
    return `${dInicio.getDate()}–${dFim.getDate()} de ${new Intl.DateTimeFormat("pt-PT", { month: "long" }).format(dFim)}`;
  }
  return `${fmt.format(dInicio)} – ${fmt.format(dFim)}`;
}
