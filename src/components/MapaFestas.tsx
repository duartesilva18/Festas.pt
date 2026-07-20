"use client";

import Image from "next/image";
import { useState } from "react";
import FestaMap from "@/components/FestaMap";
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

function CartazPlaceholder() {
  return (
    <div className="flex h-40 w-full items-center justify-center bg-gradient-to-b from-[#F97B16] to-[#EC2456]">
      <Image src="/logo-mark.svg" alt="" width={72} height={72} className="opacity-90 drop-shadow" />
    </div>
  );
}

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

      <div className="shrink-0 overflow-hidden rounded-t-2xl">
        {p.cartaz_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.cartaz_url} alt={`Cartaz de ${p.nome}`} className="h-40 w-full object-cover" />
        ) : (
          <CartazPlaceholder />
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-5">
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: `${cor}1a`, color: cor }}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: cor }} />
          {ETIQUETAS[p.estado_temporal]}
        </span>

        <h2 className="mt-2.5 text-lg font-bold leading-snug text-[#1A2E4F]">{p.nome}</h2>
        <p className="mt-0.5 text-sm text-[#1A2E4F]/60">
          {p.freguesia ? `${p.freguesia} · ` : ""}
          {p.concelho} · {p.distrito}
        </p>

        <p className="mt-3 inline-block rounded-lg bg-[#1A2E4F]/5 px-2.5 py-1.5 text-[13px] font-semibold text-[#1A2E4F]">
          📅 {formatarDatas(p.data_inicio, p.data_fim)} · {p.ano}
        </p>

        {p.categorias?.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {p.categorias.map((c) => (
              <span
                key={c}
                className="rounded-full border border-[#1A2E4F]/15 px-2.5 py-0.5 text-xs font-medium capitalize text-[#1A2E4F]/70"
              >
                {c}
              </span>
            ))}
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2">
          <a
            href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-full border border-[#1A2E4F]/15 py-2 text-sm font-semibold text-[#1A2E4F] transition hover:bg-[#1A2E4F]/5"
          >
            Waze
          </a>
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-full border border-[#1A2E4F]/15 py-2 text-sm font-semibold text-[#1A2E4F] transition hover:bg-[#1A2E4F]/5"
          >
            Google Maps
          </a>
        </div>

        <a
          href={`/festas/${p.concelho_slug}/${p.slug}`}
          className="mt-2 block rounded-full bg-gradient-to-b from-[#F97B16] to-[#EC2456] py-2.5 text-center text-sm font-bold text-white shadow-sm transition hover:shadow-md"
        >
          Ver página da festa
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

      <ul className="flex-1 divide-y divide-[#1A2E4F]/8 overflow-y-auto">
        {ordenadas.map((f) => {
          const p = f.props;
          const cor = CORES[p.estado_temporal];
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => aoEscolher(f)}
                className="flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-[#1A2E4F]/[0.04]"
              >
                <span className="mt-1.5 size-2.5 shrink-0 rounded-full" style={{ backgroundColor: cor }} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[#1A2E4F]">{p.nome}</span>
                  <span className="block text-xs text-[#1A2E4F]/60">
                    {p.concelho} · {formatarDatas(p.data_inicio, p.data_fim)}
                  </span>
                </span>
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

  return (
    <>
      <FestaMap
        dados={dados}
        aoEscolherFesta={(festa) => setPainel({ modo: "detalhe", festa, deLista: false })}
        aoEscolherGrupo={(festas) => {
          setLista(festas);
          setPainel({ modo: "lista", festas });
        }}
      />

      {painel.modo !== "fechado" && (
        <div className="absolute bottom-4 left-4 top-4 z-10 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-[#1A2E4F]/10">
          {painel.modo === "detalhe" ? (
            <DetalheFesta
              festa={painel.festa}
              deLista={painel.deLista}
              aoVoltar={() => setPainel({ modo: "lista", festas: lista })}
              aoFechar={() => setPainel({ modo: "fechado" })}
            />
          ) : (
            <ListaFestas
              festas={painel.festas}
              aoEscolher={(festa) => setPainel({ modo: "detalhe", festa, deLista: true })}
              aoFechar={() => setPainel({ modo: "fechado" })}
            />
          )}
        </div>
      )}
    </>
  );
}
