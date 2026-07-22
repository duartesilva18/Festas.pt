import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import BotaoVoltar from "@/components/BotaoVoltar";
import CartazFallback from "@/components/CartazFallback";
import Galeria from "@/components/Galeria";
import ImagemAmpliavel from "@/components/ImagemAmpliavel";
import Navbar from "@/components/Navbar";
import { nomeCategoriaPrincipal } from "@/lib/criar-evento";
import { fetchFestaDetalhe, type FestaDetalhe } from "@/lib/festa-detalhe";
import { CORES, ETIQUETAS, formatarDiaPrograma, formatarLocalizacao, resumoDatas } from "@/lib/festa-ui";

export const revalidate = 3600;

type Params = { params: Promise<{ concelho: string; slug: string }> };

function formatarIntervalo(inicio: string, fim: string | null, tipoRecorrencia: string, diasSemana: number[]): string {
  const resumo = resumoDatas(inicio, fim, tipoRecorrencia, diasSemana);
  if (resumo.secundario) return `${resumo.principal} · ${resumo.secundario}`;
  const fmt = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" });
  const dInicio = new Date(inicio + "T12:00:00");
  if (tipoRecorrencia === "fins_de_semana" && fim) {
    const dias = [...new Set(diasSemana.length ? diasSemana : [6, 7])].sort();
    const quando = dias.length === 2 && dias[0] === 6 && dias[1] === 7
      ? "Todos os fins de semana"
      : dias.length === 3 ? "Sextas, sábados e domingos" : "Semanalmente";
    return `${quando} até ${fmt.format(new Date(fim + "T12:00:00"))}`;
  }
  if (!fim || fim === inicio) return fmt.format(dInicio);
  const dFim = new Date(fim + "T12:00:00");
  const mes = new Intl.DateTimeFormat("pt-PT", { month: "long" });
  if (dInicio.getMonth() === dFim.getMonth() && dInicio.getFullYear() === dFim.getFullYear()) {
    return `${dInicio.getDate()} a ${dFim.getDate()} de ${mes.format(dFim)} de ${dFim.getFullYear()}`;
  }
  return `${fmt.format(dInicio)} – ${fmt.format(dFim)}`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { concelho, slug } = await params;
  const festa = await fetchFestaDetalhe(concelho, slug);
  if (!festa) return { title: "Festa não encontrada — Achafestas" };

  const titulo = `${festa.nome}, ${festa.concelho} (${festa.ano}) — Achafestas`;
  const descricao =
    festa.descricao ??
    `${festa.nome} em ${festa.concelho}, ${festa.distrito}. Datas, localização e direções no Achafestas.`;
  const urlPagina = `https://achafestas.com/festas/${festa.concelhoSlug}/${festa.slug}`;

  return {
    title: titulo,
    description: descricao,
    alternates: { canonical: urlPagina },
    openGraph: {
      title: titulo,
      description: descricao,
      url: urlPagina,
      locale: "pt_PT",
      type: "website",
      images: festa.cartazUrl ? [{ url: festa.cartazUrl }] : undefined,
    },
  };
}

function jsonLd(festa: FestaDetalhe) {
  return {
    "@context": "https://schema.org",
    "@type": "Festival",
    name: festa.nome,
    startDate: festa.dataInicio,
    endDate: festa.dataFim ?? festa.dataInicio,
    eventStatus:
      festa.estado === "cancelada"
        ? "https://schema.org/EventCancelled"
        : "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: festa.descricao ?? undefined,
    image: festa.cartazUrl ? [festa.cartazUrl, ...festa.fotos] : festa.fotos,
    location: {
      "@type": "Place",
      name: formatarLocalizacao(festa.freguesia, festa.concelho),
      address: {
        "@type": "PostalAddress",
        addressLocality: festa.concelho,
        addressRegion: festa.distrito,
        addressCountry: "PT",
      },
      ...(festa.lat != null && festa.lng != null
        ? { geo: { "@type": "GeoCoordinates", latitude: festa.lat, longitude: festa.lng } }
        : {}),
    },
    url: `https://achafestas.com/festas/${festa.concelhoSlug}/${festa.slug}`,
    isAccessibleForFree: true,
    inLanguage: "pt-PT",
  };
}

function serializarJsonLd(valor: unknown) {
  return JSON.stringify(valor)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function Icone({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

export default async function PaginaFesta({ params }: Params) {
  const { concelho, slug } = await params;
  const festa = await fetchFestaDetalhe(concelho, slug);
  if (!festa) notFound();

  const cor = CORES[festa.estadoTemporal];
  const base = `/festas/${festa.concelhoSlug}/${festa.slug}`;
  const temGeo = festa.lat != null && festa.lng != null;
  const local = formatarLocalizacao(festa.freguesia, festa.concelho, festa.distrito);

  return (
    <div className="min-h-dvh bg-white text-[#1A2E4F]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializarJsonLd(jsonLd(festa)) }} />

      <Navbar />

      <nav className="mx-auto max-w-5xl px-5 pt-5 text-xs text-[#1A2E4F]/50">
        <Link href="/" className="hover:text-[#1A2E4F]">Início</Link>
        <span className="px-1.5">/</span>
        <Link href={`/concelhos/${festa.concelhoSlug}`} className="hover:text-[#1A2E4F]">{festa.concelho}</Link>
        <span className="px-1.5">/</span>
        <span className="text-[#1A2E4F]/70">{festa.nome}</span>
      </nav>

      <main className="mx-auto max-w-5xl px-5 pb-20 pt-4">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-[3px] px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ backgroundColor: `${cor}17`, color: cor }}
          >
            <span className="size-1.5 rounded-full" style={{ backgroundColor: cor }} />
            {ETIQUETAS[festa.estadoTemporal]}
          </span>
          <span className="rounded-[3px] bg-[#1A2E4F]/[0.06] px-2 py-1 text-[11px] font-medium text-[#1A2E4F]/65">
            {festa.formatoEvento || nomeCategoriaPrincipal(festa.categoriaPrincipal)}
          </span>
          {festa.tagsEvento.slice(0, 3).map((c) => (
            <span key={c} className="rounded-[3px] bg-[#1A2E4F]/[0.06] px-2 py-1 text-[11px] font-medium capitalize text-[#1A2E4F]/65">
              {c}
            </span>
          ))}
        </div>

        <div className="mt-3 flex items-start gap-3">
          <BotaoVoltar className="mt-1.5" />
          <h1 className="max-w-3xl text-[28px] font-bold leading-[1.15] tracking-tight sm:text-[38px]">
            {festa.nome}
          </h1>
        </div>
        <p className="mt-2 flex items-center gap-1.5 text-[15px] text-[#1A2E4F]/60">
          <span className="text-[#EC2456]"><Icone d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z M12 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" /></span>
          {local}
        </p>

        <div className="mt-8 grid gap-10 lg:grid-cols-[300px_1fr]">
          {/* Coluna esquerda: cartaz + info prática */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:self-start">
            <div className="overflow-hidden rounded-md border border-[#1A2E4F]/12">
              {festa.cartazUrl ? (
                <ImagemAmpliavel src={festa.cartazUrl} alt={`Cartaz de ${festa.nome}`} className="w-full" />
              ) : (
                <CartazFallback nome={festa.nome} categoria={festa.categoriaPrincipal} mostrarNome className="aspect-[3/4] w-full" />
              )}
            </div>

            <div className="rounded-md border border-[#1A2E4F]/12 p-4">
              <dl className="space-y-3 text-sm">
                <div className="flex gap-3">
                  <dt className="mt-0.5 text-[#1A2E4F]/40"><Icone d="M8 2v4 M16 2v4 M3 10h18 M5 4h14v16H5z" /></dt>
                  <dd>
                    <p className="font-semibold">{formatarIntervalo(festa.dataInicio, festa.dataFim, festa.tipoRecorrencia, festa.diasSemana)}</p>
                    <p className="text-[13px] text-[#1A2E4F]/50">Edição de {festa.ano}</p>
                  </dd>
                </div>
                <div className="flex gap-3 border-t border-[#1A2E4F]/8 pt-3">
                  <dt className="mt-0.5 text-[#1A2E4F]/40"><Icone d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /></dt>
                  <dd className="text-[#1A2E4F]/80">{local}</dd>
                </div>
              </dl>

              <div className="mt-4 space-y-2">
                {temGeo && (
                  <div className="grid grid-cols-2 gap-2">
                    <a href={`https://waze.com/ul?ll=${festa.lat},${festa.lng}&navigate=yes`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center rounded border border-[#1A2E4F]/15 py-2 text-[13px] font-semibold transition hover:bg-[#1A2E4F]/[0.04]">
                      Waze
                    </a>
                    <a href={`https://www.google.com/maps/dir/?api=1&destination=${festa.lat},${festa.lng}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center rounded border border-[#1A2E4F]/15 py-2 text-[13px] font-semibold transition hover:bg-[#1A2E4F]/[0.04]">
                      Google Maps
                    </a>
                  </div>
                )}
                <a href={`${base}/calendario.ics`}
                  className="flex items-center justify-center gap-2 rounded bg-[#EC2456] py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#d11a47]">
                  <Icone d="M8 2v4 M16 2v4 M3 10h18 M5 4h14v16H5z M9 16l2 2 4-4" /> Adicionar ao calendário
                </a>
              </div>
            </div>

            {festa.fonteUrl && festa.fonteUrl.startsWith("http") && (
              <a href={festa.fonteUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-[#1A2E4F]/45 hover:text-[#1A2E4F]/70">
                <Icone d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1 M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" /> Fonte da informação
              </a>
            )}
          </aside>

          {/* Coluna direita: conteúdo */}
          <div className="min-w-0">
            {festa.descricao && (
              <section>
                <h2 className="text-lg font-bold">Sobre a festa</h2>
                <p className="mt-3 text-[15px] leading-[1.75] text-[#1A2E4F]/80">{festa.descricao}</p>
              </section>
            )}

            <section className="mt-10">
              <h2 className="text-lg font-bold">Galeria</h2>
              {festa.fotos.length > 0 ? (
                <div className="mt-3">
                  <Galeria fotos={festa.fotos} variante="pagina" />
                </div>
              ) : (
                <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-[#1A2E4F]/15 py-12 text-center text-[#1A2E4F]/40">
                  <Icone d="M4 5h16v14H4z M4 15l4-4 3 3 4-4 5 5 M9 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" />
                  <p className="text-sm font-medium">Ainda sem fotos desta festa</p>
                  <p className="text-xs">Foste? Em breve poderás partilhar as tuas.</p>
                </div>
              )}
            </section>

            {festa.programa && festa.programa.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-bold">Programa</h2>
                <div className="mt-3 divide-y divide-[#1A2E4F]/10 border-y border-[#1A2E4F]/10">
                  {festa.programa.map((dia) => (
                    <div key={dia.dia} className="py-4">
                      <p className="text-sm font-bold capitalize text-[#EC2456]">{formatarDiaPrograma(dia.dia)}</p>
                      <ul className="mt-2 space-y-1.5">
                        {dia.eventos.map((ev, i) => (
                          <li key={i} className="flex gap-4 text-sm text-[#1A2E4F]/80">
                            {ev.hora && <span className="w-14 shrink-0 font-semibold tabular-nums text-[#1A2E4F]">{ev.hora}</span>}
                            <span>{ev.titulo}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
