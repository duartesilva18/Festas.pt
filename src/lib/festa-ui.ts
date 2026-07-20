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
