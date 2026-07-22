"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { estadoTemporal } from "@/lib/eventos";
import { formatarDatas } from "@/lib/festa-ui";

type Festa = { id: string; slug: string; nome: string; concelho: string; concelho_slug: string; distrito: string; data_inicio: string; data_fim: string | null; cartaz_url: string | null; tipo_recorrencia: string; dias_semana: number[] };
type Grupo = "decorrer" | "proximas" | "passadas";

const TEXTOS: Record<Grupo, string> = { decorrer: "A decorrer", proximas: "Próximas", passadas: "Já passaram" };

function grupoDaFesta(festa: Festa, hoje: Date): Grupo {
  if ((festa.data_fim ?? festa.data_inicio) < hoje.toISOString().slice(0, 10)) return "passadas";
  return estadoTemporal(festa.data_inicio, festa.data_fim, hoje, festa.tipo_recorrencia, festa.dias_semana) === "a_decorrer" ? "decorrer" : "proximas";
}

export default function FestasGuardadasPerfil({ festas }: { festas: Festa[] }) {
  const { alternar } = useAuth();
  const router = useRouter();
  const [aRemover, setARemover] = useState<string | null>(null);
  const [grupoAtivo, setGrupoAtivo] = useState<Grupo>("proximas");
  const grupos = useMemo(() => {
    const hoje = new Date();
    return { decorrer: festas.filter((festa) => grupoDaFesta(festa, hoje) === "decorrer"), proximas: festas.filter((festa) => grupoDaFesta(festa, hoje) === "proximas"), passadas: festas.filter((festa) => grupoDaFesta(festa, hoje) === "passadas") };
  }, [festas]);
  const remover = async (evento: React.MouseEvent<HTMLButtonElement>, id: string) => {
    evento.preventDefault();
    evento.stopPropagation();
    if (aRemover) return;
    setARemover(id);
    try {
      if (await alternar(id) === "removido") router.refresh();
    } finally { setARemover(null); }
  };

  if (festas.length === 0) return <section className="rounded-2xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">A tua lista</p><h2 className="mt-1 text-xl font-bold text-[#102745]">Festas guardadas</h2><div className="mt-5 flex flex-col items-center rounded-xl border border-dashed border-[#1A2E4F]/15 py-10 text-center"><p className="text-sm font-semibold text-[#1A2E4F]/70">Ainda não guardaste nenhuma festa</p><Link href="/" className="mt-3 cursor-pointer text-sm font-bold text-[#EC2456]">Explorar o mapa</Link></div></section>;

  const visiveis = grupos[grupoAtivo];
  return <section className="rounded-2xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">A tua lista</p><h2 className="mt-1 text-xl font-bold text-[#102745]">Festas guardadas</h2></div><Link href="/" className="cursor-pointer text-sm font-bold text-[#EC2456] transition hover:text-[#d11a47]">Explorar mapa</Link></div><div className="mt-5 flex gap-1 rounded-lg bg-[#1A2E4F]/[0.045] p-1">{(["decorrer", "proximas", "passadas"] as Grupo[]).map((grupo) => <button key={grupo} type="button" onClick={() => setGrupoAtivo(grupo)} className={`flex-1 cursor-pointer rounded-md px-2 py-2 text-[11px] font-bold transition ${grupoAtivo === grupo ? "bg-white text-[#EC2456] shadow-sm" : "text-[#1A2E4F]/55 hover:text-[#1A2E4F]"}`}>{TEXTOS[grupo]} <span className="opacity-55">{grupos[grupo].length}</span></button>)}</div>{visiveis.length === 0 ? <p className="py-8 text-center text-sm text-[#1A2E4F]/55">Não tens festas nesta secção.</p> : <ul className="mt-4 grid gap-3 sm:grid-cols-2">{visiveis.map((festa) => <li key={festa.id} className="group relative overflow-hidden rounded-xl ring-1 ring-[#1A2E4F]/10 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-[#EC2456]/30"><Link href={`/festas/${festa.concelho_slug}/${festa.slug}`} className="flex overflow-hidden"><div className="relative size-24 shrink-0 overflow-hidden">{festa.cartaz_url ? <img src={festa.cartaz_url} alt="" className="size-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="size-full bg-[#1A2E4F]/[0.06]" />}</div><div className="min-w-0 flex-1 p-3 pr-10"><p className="truncate text-sm font-bold text-[#102745]">{festa.nome}</p><p className="mt-0.5 truncate text-xs text-[#1A2E4F]/60">{festa.concelho} · {festa.distrito}</p><p className="mt-2 inline-block rounded bg-[#1A2E4F]/5 px-2 py-0.5 text-[11px] font-semibold text-[#1A2E4F]">{formatarDatas(festa.data_inicio, festa.data_fim, festa.tipo_recorrencia, festa.dias_semana)}</p></div></Link><button type="button" onClick={(e) => void remover(e, festa.id)} disabled={aRemover === festa.id} aria-label={`Remover ${festa.nome} dos guardados`} className="absolute right-2 top-2 flex size-7 cursor-pointer items-center justify-center rounded-full bg-white/95 text-[#1A2E4F]/50 shadow-sm transition hover:bg-[#EC2456] hover:text-white disabled:cursor-wait disabled:opacity-60"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 3h12v18l-6-4-6 4z" /></svg></button></li>)}</ul>}</section>;
}
