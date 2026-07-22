"use client";

/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { formatarDatas } from "@/lib/festa-ui";

type Festa = { id: string; slug: string; nome: string; concelho: string; concelho_slug: string; distrito: string; data_inicio: string; data_fim: string | null; cartaz_url: string | null };

export default function FestasGuardadasPerfil({ festas }: { festas: Festa[] }) {
  const { alternar } = useAuth();
  const router = useRouter();
  const [aRemover, setARemover] = useState<string | null>(null);
  const remover = async (evento: React.MouseEvent<HTMLButtonElement>, id: string) => {
    evento.preventDefault();
    evento.stopPropagation();
    if (aRemover) return;
    setARemover(id);
    try {
      const resultado = await alternar(id);
      if (resultado === "removido") router.refresh();
    } finally {
      setARemover(null);
    }
  };

  return <section className="rounded-2xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm sm:p-6"><div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">A tua lista</p><h2 className="mt-1 text-xl font-bold text-[#102745]">Festas guardadas</h2></div>{festas.length > 0 && <Link href="/" className="text-sm font-bold text-[#EC2456] transition hover:text-[#d11a47]">Explorar mapa</Link>}</div>{festas.length === 0 ? <div className="mt-5 flex flex-col items-center justify-center rounded-xl border border-dashed border-[#1A2E4F]/15 py-10 text-center"><span className="flex size-11 items-center justify-center rounded-xl bg-[#1A2E4F]/[0.06] text-[#1A2E4F]/50"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg></span><p className="mt-3 text-sm font-semibold text-[#1A2E4F]/70">Ainda não guardaste nenhuma festa</p><p className="mt-1 max-w-xs text-xs text-[#1A2E4F]/50">Carrega em “Guardar” numa festa no mapa e ela aparece aqui.</p><Link href="/" className="mt-4 inline-flex cursor-pointer rounded-lg border border-[#1A2E4F]/15 px-4 py-2 text-sm font-bold text-[#1A2E4F] transition hover:border-[#EC2456]/40 hover:text-[#EC2456]">Explorar o mapa</Link></div> : <ul className="mt-5 grid gap-3 sm:grid-cols-2">{festas.map((festa) => <li key={festa.id} className="relative group overflow-hidden rounded-xl ring-1 ring-[#1A2E4F]/10 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-[#EC2456]/30"><Link href={`/festas/${festa.concelho_slug}/${festa.slug}`} className="flex overflow-hidden"><div className="relative size-24 shrink-0 overflow-hidden">{festa.cartaz_url ? <img src={festa.cartaz_url} alt="" className="size-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="size-full bg-gradient-to-br from-[#F97B16] to-[#EC2456]" />}</div><div className="min-w-0 flex-1 p-3 pr-10"><p className="truncate text-sm font-bold text-[#102745]">{festa.nome}</p><p className="mt-0.5 truncate text-xs text-[#1A2E4F]/60">{festa.concelho} · {festa.distrito}</p><p className="mt-2 inline-block rounded bg-[#1A2E4F]/5 px-2 py-0.5 text-[11px] font-semibold text-[#1A2E4F]">{formatarDatas(festa.data_inicio, festa.data_fim)}</p></div></Link><button type="button" onClick={(e) => void remover(e, festa.id)} disabled={aRemover === festa.id} aria-label={`Remover ${festa.nome} dos guardados`} className="absolute right-2 top-2 flex size-7 cursor-pointer items-center justify-center rounded-full bg-white/95 text-[#1A2E4F]/50 shadow-sm transition hover:bg-[#EC2456] hover:text-white disabled:cursor-wait disabled:opacity-60"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg></button></li>)}</ul>}</section>;
}
