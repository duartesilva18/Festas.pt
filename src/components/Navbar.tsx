"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type OpcaoPesquisa = { id: string; nome: string; localizacao: string; cartazUrl: string | null };
const CHAVE_PESQUISAS_RECENTES = "achafestas:pesquisas-recentes";

function normalizarPesquisa(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function lerPesquisasRecentes(opcoes: OpcaoPesquisa[]) {
  if (typeof window === "undefined") return [];
  try {
    const ids = JSON.parse(window.localStorage.getItem(CHAVE_PESQUISAS_RECENTES) ?? "[]");
    if (!Array.isArray(ids)) return [];
    return ids.flatMap((id) => typeof id === "string" ? opcoes.filter((opcao) => opcao.id === id) : []).slice(0, 5);
  } catch {
    return [];
  }
}

function CampoPesquisa({ className = "", opcoes = [] }: { className?: string; opcoes?: OpcaoPesquisa[] }) {
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [recentes, setRecentes] = useState<OpcaoPesquisa[]>(() => lerPesquisasRecentes(opcoes));
  const consulta = normalizarPesquisa(termo.trim());
  const sugestoes = consulta.length >= 2
    ? opcoes.filter((opcao) => normalizarPesquisa(`${opcao.nome} ${opcao.localizacao}`).includes(consulta)).slice(0, 6)
    : [];

  const guardarRecente = (opcao: OpcaoPesquisa) => {
    const proximos = [opcao, ...recentes.filter((recente) => recente.id !== opcao.id)].slice(0, 5);
    setRecentes(proximos);
    try {
      window.localStorage.setItem(CHAVE_PESQUISAS_RECENTES, JSON.stringify(proximos.map((recente) => recente.id)));
    } catch {}
  };

  const abrirFesta = (opcao: OpcaoPesquisa) => {
    guardarRecente(opcao);
    window.dispatchEvent(new CustomEvent("achafestas:abrir-festa", { detail: opcao.id }));
    setTermo("");
    setAberto(false);
  };

  const pesquisar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const valor = termo.trim();
    if (valor) {
      window.dispatchEvent(new CustomEvent("achafestas:pesquisa", { detail: valor }));
      setAberto(false);
    }
  };

  const resultadosVisiveis = sugestoes.length > 0;
  const recentesVisiveis = aberto && !termo.trim() && recentes.length > 0;

  return (
    <form onSubmit={pesquisar} onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAberto(false); }} className={`relative flex items-center gap-2.5 rounded-full border border-[#1A2E4F]/15 bg-[#1A2E4F]/[0.03] px-4 py-2 transition focus-within:border-[#EC2456]/50 focus-within:bg-white ${className}`}>
      <button type="submit" aria-label="Pesquisar" className="flex size-6 shrink-0 items-center justify-center text-[#1A2E4F]/40 transition hover:text-[#EC2456]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>
      <input
        type="search"
        value={termo}
        onFocus={() => { setRecentes(lerPesquisasRecentes(opcoes)); setAberto(true); }}
        onChange={(event) => { setTermo(event.target.value); setAberto(true); }}
        onKeyDown={(event) => { if (event.key === "Escape") setAberto(false); }}
        aria-label="Procura uma festa, vila ou concelho"
        placeholder="Procura uma festa, vila ou concelho…"
        className="w-full bg-transparent text-sm text-[#1A2E4F] outline-none placeholder:text-[#1A2E4F]/40"
      />
      {(resultadosVisiveis || recentesVisiveis) && (
        <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-[#1A2E4F]/10 bg-white py-1.5 shadow-xl">
          {recentesVisiveis && <li className="flex items-center justify-between px-3.5 pb-1 pt-1.5"><span className="text-[10px] font-bold uppercase tracking-wide text-[#1A2E4F]/45">Pesquisas recentes</span><button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => { setRecentes([]); window.localStorage.removeItem(CHAVE_PESQUISAS_RECENTES); }} className="cursor-pointer text-[10px] font-bold text-[#EC2456] transition hover:text-[#d11a47]">Limpar</button></li>}
          {(resultadosVisiveis ? sugestoes : recentes).map((opcao) => (
            <li key={opcao.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => abrirFesta(opcao)}
                className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-left transition hover:bg-[#EC2456]/[0.05]"
              >
                <span className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#EC2456]/10 text-[#EC2456]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2" /></svg>
                  {opcao.cartazUrl && <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={opcao.cartazUrl} alt="" className="absolute inset-0 size-full object-cover" onError={(event) => { event.currentTarget.style.display = "none"; }} />
                  </>}
                </span>
                <span className="min-w-0"><span className="block truncate text-sm font-semibold text-[#102745]">{opcao.nome}</span><span className="block truncate text-[11px] text-[#1A2E4F]/55">{opcao.localizacao}</span></span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}

export default function Navbar({ contagem, opcoesPesquisa = [] }: { contagem?: number; opcoesPesquisa?: OpcaoPesquisa[] }) {
  return (
    <header className="z-20 shrink-0 bg-white">
      <div className="px-4 sm:px-6">
        <div className="flex h-16 items-center gap-4 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center">
            <Image src="/logo.svg" alt="Achafestas" width={188} height={40} priority className="w-[150px] sm:w-[188px]" />
          </Link>

          <CampoPesquisa opcoes={opcoesPesquisa} className="mx-auto hidden min-w-0 max-w-md flex-1 md:flex" />

          <nav className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            {contagem != null && (
              <span className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium text-[#1A2E4F]/70 lg:flex">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#EC2456] opacity-60" />
                  <span className="relative inline-flex size-2 rounded-full bg-[#EC2456]" />
                </span>
                {contagem} festas no mapa
              </span>
            )}
            <Link
              href="/"
              className="hidden rounded-full px-3 py-2 text-sm font-semibold text-[#1A2E4F] transition hover:bg-[#1A2E4F]/5 lg:block"
            >
              Mapa
            </Link>
            <span
              className="hidden cursor-not-allowed rounded-full px-3 py-2 text-sm font-medium text-[#1A2E4F]/40 lg:block"
              title="Disponível em breve"
            >
              Submeter festa
            </span>
            <button
              type="button"
              className="cursor-not-allowed rounded-full bg-gradient-to-b from-[#F97B16] to-[#EC2456] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:shadow-md sm:ml-1 sm:px-5"
              title="Disponível em breve"
            >
              Entrar
            </button>
          </nav>
        </div>

        {/* Pesquisa em segunda linha nos ecrãs pequenos */}
        <div className="pb-3 md:hidden">
          <CampoPesquisa opcoes={opcoesPesquisa} />
        </div>
      </div>
      <div className="h-0.5 bg-gradient-to-r from-[#F97B16] via-[#EC2456] to-[#1A2E4F]" />
    </header>
  );
}
