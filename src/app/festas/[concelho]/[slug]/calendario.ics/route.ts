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

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ concelho: string; slug: string }> },
) {
  const { concelho, slug } = await params;
  const festa = await fetchFestaDetalhe(concelho, slug);
  if (!festa) return new Response("Não encontrado", { status: 404 });

  const dtStart = formatarData(festa.dataInicio);
  const dtEnd = fimExclusivo(festa.dataFim ?? festa.dataInicio);
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
