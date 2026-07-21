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

export function formatarDatas(inicio: string, fim: string | null): string {
  const fmt = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" });
  const dInicio = new Date(inicio + "T12:00:00");
  if (!fim || fim === inicio) return fmt.format(dInicio);
  const dFim = new Date(fim + "T12:00:00");
  if (dInicio.getMonth() === dFim.getMonth()) {
    return `${dInicio.getDate()}–${dFim.getDate()} de ${new Intl.DateTimeFormat("pt-PT", { month: "long" }).format(dFim)}`;
  }
  return `${fmt.format(dInicio)} – ${fmt.format(dFim)}`;
}
