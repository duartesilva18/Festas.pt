"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export type OpcaoPesquisa = { id: string; nome: string; localizacao: string; cartazUrl: string | null };

function normalizarPesquisa(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function CampoPesquisa({ className = "", opcoes = [] }: { className?: string; opcoes?: OpcaoPesquisa[] }) {
  const [termo, setTermo] = useState("");
  const consulta = normalizarPesquisa(termo.trim());
  const sugestoes = consulta.length >= 2
    ? opcoes.filter((opcao) => normalizarPesquisa(`${opcao.nome} ${opcao.localizacao}`).includes(consulta)).slice(0, 6)
    : [];
  const pesquisar = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const valor = termo.trim();
    if (valor) window.dispatchEvent(new CustomEvent("achafestas:pesquisa", { detail: valor }));
  };
  return (
    <form onSubmit={pesquisar} className={`relative flex items-center gap-2.5 rounded-full border border-[#1A2E4F]/15 bg-[#1A2E4F]/[0.03] px-4 py-2 transition focus-within:border-[#EC2456]/50 focus-within:bg-white ${className}`}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1A2E4F" strokeWidth="2.2" strokeLinecap="round" className="shrink-0 opacity-40">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        type="search"
        value={termo}
        onChange={(event) => setTermo(event.target.value)}
        aria-label="Procura uma festa, vila ou concelho"
        placeholder="Procura uma festa, vila ou concelho…"
        className="w-full bg-transparent text-sm text-[#1A2E4F] outline-none placeholder:text-[#1A2E4F]/40"
      />
      <button type="submit" aria-label="Pesquisar" className="-mr-1 flex size-7 shrink-0 items-center justify-center rounded-full text-[#1A2E4F]/45 transition hover:bg-[#EC2456]/10 hover:text-[#EC2456]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
      </button>
      {sugestoes.length > 0 && (
        <ul className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-[#1A2E4F]/10 bg-white py-1.5 shadow-xl">
          {sugestoes.map((opcao) => (
            <li key={opcao.id}>
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  window.dispatchEvent(new CustomEvent("achafestas:abrir-festa", { detail: opcao.id }));
                  setTermo("");
                }}
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
