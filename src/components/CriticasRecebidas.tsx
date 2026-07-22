"use client";

import { useMemo, useState } from "react";

type Critica = {
  id: string;
  autor: string;
  evento: string;
  nota: number;
  texto: string;
  criadaEm: string;
};

export default function CriticasRecebidas({ criticas, demonstracao, media, total }: { criticas: Critica[]; demonstracao: boolean; media: number | null; total: number }) {
  const [evento, setEvento] = useState("todas");
  const [nota, setNota] = useState<"todas" | "5" | "ate4">("todas");
  const [ordem, setOrdem] = useState<"recentes" | "antigas">("recentes");
  const eventos = [...new Set(criticas.map((critica) => critica.evento))];
  const visiveis = useMemo(() => [...criticas]
    .filter((critica) => evento === "todas" || critica.evento === evento)
    .filter((critica) => nota === "todas" || (nota === "5" ? critica.nota === 5 : critica.nota <= 4))
    .sort((a, b) => ordem === "recentes" ? b.criadaEm.localeCompare(a.criadaEm) : a.criadaEm.localeCompare(b.criadaEm)), [criticas, evento, nota, ordem]);

  return (
    <section className="rounded-2xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#EC2456]">Feedback</p><h2 className="mt-1 text-xl font-bold text-[#102745]">Críticas recebidas</h2><p className="mt-1 text-sm text-[#1A2E4F]/60">{media === null ? "Ainda sem críticas reais nos teus eventos." : `${media.toFixed(1).replace(".", ",")} ★ · ${total} crítica${total === 1 ? "" : "s"}`}</p></div>{demonstracao && <span className="rounded-full bg-[#1A2E4F]/[0.06] px-2.5 py-1 text-[11px] font-semibold text-[#1A2E4F]/60">Pré-visualização</span>}</div>
      <div className="mt-5 flex flex-wrap items-center gap-2 border-y border-[#1A2E4F]/8 py-3">
        <select value={evento} onChange={(e) => setEvento(e.target.value)} aria-label="Filtrar por evento" className="cursor-pointer rounded-lg border border-[#1A2E4F]/12 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#1A2E4F] outline-none transition focus:border-[#EC2456]"><option value="todas">Todos os eventos</option>{eventos.map((nome) => <option key={nome} value={nome}>{nome}</option>)}</select>
        <div className="flex rounded-lg bg-[#1A2E4F]/[0.045] p-0.5" aria-label="Filtrar por nota">{([['todas', 'Todas'], ['5', '5 ★'], ['ate4', '≤ 4 ★']] as const).map(([valor, texto]) => <button key={valor} type="button" onClick={() => setNota(valor)} className={`cursor-pointer rounded-md px-2.5 py-1.5 text-[11px] font-bold transition ${nota === valor ? "bg-white text-[#EC2456] shadow-sm" : "text-[#1A2E4F]/55 hover:text-[#1A2E4F]"}`}>{texto}</button>)}</div>
        <button type="button" onClick={() => setOrdem((atual) => atual === "recentes" ? "antigas" : "recentes")} className="ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#1A2E4F]/60 transition hover:bg-[#1A2E4F]/[0.05] hover:text-[#EC2456]"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 3v14M4 6l3-3 3 3M17 21V7m-3 11 3 3 3-3" /></svg>{ordem === "recentes" ? "Mais recentes" : "Mais antigas"}</button>
      </div>
      {visiveis.length === 0 ? <p className="py-6 text-center text-sm text-[#1A2E4F]/55">Não encontrámos críticas com estes filtros.</p> : <ul className="divide-y divide-[#1A2E4F]/8">{visiveis.map((critica) => <li key={critica.id} className="py-4 first:pt-4 last:pb-0"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-bold text-[#102745]">{critica.autor}</p><p className="mt-0.5 truncate text-xs text-[#1A2E4F]/55">{critica.evento}</p></div><span className="shrink-0 text-sm font-bold text-[#F97B16]">{critica.nota.toFixed(1).replace(".", ",")} ★</span></div><p className="mt-2 line-clamp-2 text-sm leading-relaxed text-[#1A2E4F]/75">{critica.texto}</p></li>)}</ul>}
    </section>
  );
}
