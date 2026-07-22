import { fetchFestaDetalhe } from "@/lib/festa-detalhe";

export const revalidate = 3600;

function formatarData(d: string): string {
  return d.replace(/-/g, "");
}

function fimExclusivo(fim: string): string {
  // DTEND de eventos de dia inteiro é exclusivo → dia seguinte ao fim.
  // Usa UTC para evitar deslocamento por fuso horário.
  const d = new Date(fim + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

function escaparTextoIcs(valor: string): string {
  return valor
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function primeiraOcorrencia(inicio: string, fim: string, diasSemana: number[]) {
  const cursor = new Date(`${inicio}T12:00:00Z`);
  const limite = new Date(`${fim}T12:00:00Z`);
  for (let i = 0; i < 7 && cursor <= limite; i += 1) {
    if (diasSemana.includes(cursor.getUTCDay() || 7)) return cursor.toISOString().slice(0, 10);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return inicio;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ concelho: string; slug: string }> },
) {
  const { concelho, slug } = await params;
  const festa = await fetchFestaDetalhe(concelho, slug);
  if (!festa) return new Response("Não encontrado", { status: 404 });

  const recorrente = festa.tipoRecorrencia === "fins_de_semana" && Boolean(festa.dataFim);
  const diasSemana = festa.diasSemana.length ? festa.diasSemana : [6, 7];
  const inicioReal = recorrente ? primeiraOcorrencia(festa.dataInicio, festa.dataFim!, diasSemana) : festa.dataInicio;
  const dtStart = formatarData(inicioReal);
  const dtEnd = fimExclusivo(recorrente ? inicioReal : (festa.dataFim ?? festa.dataInicio));
  const local = [festa.freguesia, festa.concelho, festa.distrito, "Portugal"]
    .filter(Boolean)
    .join(", ");
  const descricao = escaparTextoIcs(festa.descricao ?? "");

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//achafestas//PT",
    "BEGIN:VEVENT",
    `UID:${festa.concelhoSlug}-${festa.slug}-${festa.ano}@achafestas.com`,
    `DTSTAMP:${dtStart}T000000Z`,
    `DTSTART;VALUE=DATE:${dtStart}`,
    `DTEND;VALUE=DATE:${dtEnd}`,
    ...(recorrente ? [`RRULE:FREQ=WEEKLY;BYDAY=${diasSemana.map((dia) => ({ 5: "FR", 6: "SA", 7: "SU" })[dia as 5 | 6 | 7]).filter(Boolean).join(",")};UNTIL=${formatarData(festa.dataFim!)}T235959Z`] : []),
    `SUMMARY:${escaparTextoIcs(festa.nome)}`,
    `LOCATION:${escaparTextoIcs(local)}`,
    `DESCRIPTION:${descricao}`,
    `URL:https://achafestas.com/festas/${festa.concelhoSlug}/${festa.slug}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${festa.slug}.ics"`,
    },
  });
}
