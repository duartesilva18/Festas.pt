"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import FestaMap, { type FestaMapHandle } from "@/components/FestaMap";
import type { FestasGeoJSON } from "@/lib/eventos";
import { CORES, ETIQUETAS, formatarDatas, type FestaSelecionada } from "@/lib/festa-ui";

type Painel =
  | { modo: "fechado" }
  | { modo: "detalhe"; festa: FestaSelecionada; deLista: boolean }
  | { modo: "lista"; festas: FestaSelecionada[] };

function BotaoFechar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Fechar"
      className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-[#1A2E4F]/70 shadow transition hover:bg-white hover:text-[#1A2E4F]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

type DetalheExtra = { descricao: string | null; cartazUrl: string | null; fotos: string[] };

function DetalheFesta({
  festa,
  deLista,
  aoVoltar,
  aoFechar,
}: {
  festa: FestaSelecionada;
  deLista: boolean;
  aoVoltar: () => void;
  aoFechar: () => void;
}) {
  const p = festa.props;
  const [lng, lat] = festa.lngLat;
  const cor = CORES[p.estado_temporal];
  const [extra, setExtra] = useState<DetalheExtra | null>(null);

  useEffect(() => {
    let ativo = true;
    setExtra(null);
    fetch(`/api/festa?concelho=${p.concelho_slug}&slug=${p.slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => ativo && d && setExtra(d))
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [p.concelho_slug, p.slug]);

  const cartaz = extra?.cartazUrl ?? p.cartaz_url;
  const fotos = extra?.fotos ?? [];

  return (
    <div className="relative flex h-full flex-col">
      <BotaoFechar onClick={aoFechar} />
      {deLista && (
        <button
          type="button"
          onClick={aoVoltar}
          className="absolute left-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-[#1A2E4F]/70 shadow transition hover:bg-white hover:text-[#1A2E4F]"
          aria-label="Voltar à lista"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}

      <div className="relative shrink-0">
        {cartaz ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cartaz} alt={`Cartaz de ${p.nome}`} className="h-36 w-full object-cover" />
        ) : (
          <div className="flex h-36 w-full items-center justify-center bg-gradient-to-b from-[#F97B16] to-[#EC2456]">
            <Image src="/logo-mark.svg" alt="" width={60} height={60} className="opacity-90 drop-shadow" />
          </div>
        )}
        <span
          className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-[3px] bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm"
          style={{ color: cor }}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: cor }} />
          {ETIQUETAS[p.estado_temporal]}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <h2 className="text-lg font-bold leading-snug text-[#1A2E4F]">{p.nome}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-[#1A2E4F]/60">
          <span className="text-[#EC2456]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2" />
            </svg>
          </span>
          {p.freguesia ? `${p.freguesia}, ` : ""}{p.concelho} · {p.distrito}
        </p>

        <div className="mt-3 flex items-center gap-2 rounded-md bg-[#1A2E4F]/[0.05] px-3 py-2 text-[13px] font-semibold text-[#1A2E4F]">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v4M16 2v4M3 10h18" /><rect x="5" y="4" width="14" height="16" rx="1" />
          </svg>
          {formatarDatas(p.data_inicio, p.data_fim)} · {p.ano}
        </div>

        {p.categorias?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.categorias.map((c) => (
              <span key={c} className="rounded-[3px] bg-[#1A2E4F]/[0.06] px-2 py-0.5 text-[11px] font-medium capitalize text-[#1A2E4F]/65">
                {c}
              </span>
            ))}
          </div>
        )}

        {extra?.descricao && (
          <p className="mt-3 text-[13px] leading-relaxed text-[#1A2E4F]/70">
            {extra.descricao.length > 180 ? `${extra.descricao.slice(0, 180)}…` : extra.descricao}
          </p>
        )}

        {fotos.length > 0 && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {fotos.slice(0, 6).map((foto, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={foto} alt={`${p.nome} — foto ${i + 1}`} className="h-20 w-24 shrink-0 rounded-md object-cover" />
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <a href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center rounded border border-[#1A2E4F]/15 py-2 text-sm font-semibold text-[#1A2E4F] transition hover:bg-[#1A2E4F]/5">
            Waze
          </a>
          <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center rounded border border-[#1A2E4F]/15 py-2 text-sm font-semibold text-[#1A2E4F] transition hover:bg-[#1A2E4F]/5">
            Google Maps
          </a>
        </div>

        <a href={`/festas/${p.concelho_slug}/${p.slug}`}
          className="mt-2 flex items-center justify-center gap-1.5 rounded bg-[#EC2456] py-2.5 text-sm font-bold text-white transition hover:bg-[#d11a47]">
          Ver página da festa
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    </div>
  );
}

function ListaFestas({
  festas,
  aoEscolher,
  aoFechar,
}: {
  festas: FestaSelecionada[];
  aoEscolher: (f: FestaSelecionada) => void;
  aoFechar: () => void;
}) {
  const ordenadas = [...festas].sort((a, b) =>
    a.props.data_inicio.localeCompare(b.props.data_inicio),
  );
  const concelhos = [...new Set(ordenadas.map((f) => f.props.concelho))];

  return (
    <div className="relative flex h-full flex-col">
      <BotaoFechar onClick={aoFechar} />
      <div className="shrink-0 border-b border-[#1A2E4F]/10 p-5 pb-4">
        <h2 className="text-lg font-bold text-[#1A2E4F]">
          {ordenadas.length} festas nesta zona
        </h2>
        <p className="mt-0.5 truncate text-sm text-[#1A2E4F]/60">{concelhos.join(" · ")}</p>
      </div>

      <ul className="flex-1 space-y-3 overflow-y-auto p-4">
        {ordenadas.map((f) => {
          const p = f.props;
          const cor = CORES[p.estado_temporal];
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => aoEscolher(f)}
                className="group w-full overflow-hidden rounded-md text-left ring-1 ring-[#1A2E4F]/10 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-[#EC2456]/30"
              >
                <div className="relative h-24 w-full overflow-hidden">
                  {p.cartaz_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.cartaz_url}
                      alt=""
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#F97B16] to-[#EC2456]">
                      <Image src="/logo-mark.svg" alt="" width={40} height={40} className="opacity-80" />
                    </div>
                  )}
                  <span
                    className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm"
                    style={{ color: cor }}
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: cor }} />
                    {ETIQUETAS[p.estado_temporal]}
                  </span>
                </div>
                <div className="p-3">
                  <span className="block truncate text-sm font-bold text-[#1A2E4F]">{p.nome}</span>
                  <span className="mt-0.5 block text-xs text-[#1A2E4F]/60">
                    {p.concelho} · {p.distrito}
                  </span>
                  <span className="mt-1.5 inline-block rounded-md bg-[#1A2E4F]/5 px-2 py-0.5 text-[11px] font-semibold text-[#1A2E4F]">
                    📅 {formatarDatas(p.data_inicio, p.data_fim)}
                  </span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default function MapaFestas({ dados }: { dados: FestasGeoJSON }) {
  const [painel, setPainel] = useState<Painel>({ modo: "fechado" });
  const [lista, setLista] = useState<FestaSelecionada[]>([]);
  const [aFechar, setAFechar] = useState(false);
  const mapaRef = useRef<FestaMapHandle>(null);

  function fechar() {
    setAFechar(true);
    mapaRef.current?.reporVista();
    setTimeout(() => {
      setPainel({ modo: "fechado" });
      setAFechar(false);
    }, 200);
  }

  function abrir(novo: Painel) {
    setAFechar(false);
    setPainel(novo);
  }

  const chaveConteudo =
    painel.modo === "detalhe" ? `detalhe-${painel.festa.props.id}` : painel.modo;

  return (
    <>
      <FestaMap
        ref={mapaRef}
        dados={dados}
        aoEscolherFesta={(festa) => abrir({ modo: "detalhe", festa, deLista: false })}
        aoEscolherGrupo={(festas) => {
          setLista(festas);
          abrir({ modo: "lista", festas });
        }}
      />

      {painel.modo !== "fechado" && (
        <div
          className={`painel-entrada absolute z-10 overflow-hidden bg-white shadow-2xl ring-1 ring-[#1A2E4F]/10 inset-x-0 bottom-0 h-[68vh] rounded-t-xl sm:inset-x-auto sm:bottom-4 sm:left-4 sm:top-4 sm:h-auto sm:w-[360px] sm:rounded-lg ${aFechar ? "painel-saida" : ""}`}
        >
          <div className="absolute left-1/2 top-2 z-20 h-1 w-9 -translate-x-1/2 rounded-full bg-[#1A2E4F]/20 sm:hidden" />
          <div key={chaveConteudo} className="conteudo-entrada h-full">
            {painel.modo === "detalhe" ? (
              <DetalheFesta
                festa={painel.festa}
                deLista={painel.deLista}
                aoVoltar={() => abrir({ modo: "lista", festas: lista })}
                aoFechar={fechar}
              />
            ) : (
              <ListaFestas
                festas={painel.festas}
                aoEscolher={(festa) => abrir({ modo: "detalhe", festa, deLista: true })}
                aoFechar={fechar}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
