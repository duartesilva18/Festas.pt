"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Concelho = { id: string; nome: string; distrito: string };

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function SeletorConcelho({
  concelhos,
  valor,
  onAlterar,
  className,
  invalido,
}: {
  concelhos: Concelho[];
  valor: string;
  onAlterar: (id: string) => void;
  className?: string;
  invalido?: boolean;
}) {
  const selecionado = useMemo(() => concelhos.find((c) => c.id === valor) ?? null, [concelhos, valor]);
  const [termo, setTermo] = useState("");
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fora = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setAberto(false); setTermo(""); } };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, []);

  const resultados = useMemo(() => {
    const alvo = normalizar(termo.trim());
    const lista = alvo ? concelhos.filter((c) => normalizar(`${c.nome} ${c.distrito}`).includes(alvo)) : concelhos;
    return lista.slice(0, 40);
  }, [concelhos, termo]);

  useEffect(() => setAtivo(0), [termo]);

  const escolher = (c: Concelho) => {
    onAlterar(c.id);
    setTermo("");
    setAberto(false);
  };

  return (
    <div ref={ref} className={`relative ${className ?? ""}`}>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={aberto ? termo : (selecionado ? `${selecionado.nome} · ${selecionado.distrito}` : "")}
          onChange={(e) => { setTermo(e.target.value); if (!aberto) setAberto(true); }}
          onFocus={() => { setAberto(true); setTermo(""); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((v) => Math.min(v + 1, resultados.length - 1)); }
            else if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((v) => Math.max(v - 1, 0)); }
            else if (e.key === "Enter") { e.preventDefault(); if (resultados[ativo]) escolher(resultados[ativo]); }
            else if (e.key === "Escape") { setAberto(false); setTermo(""); inputRef.current?.blur(); }
          }}
          placeholder="Escrever o nome do concelho…"
          role="combobox"
          aria-expanded={aberto}
          aria-autocomplete="list"
          className={`mt-1.5 w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-[#102745] outline-none transition placeholder:text-[#1A2E4F]/35 ${
            invalido
              ? "border-[#c43d4b]/60 bg-[#c43d4b]/[0.03] focus:border-[#c43d4b] focus:ring-2 focus:ring-[#c43d4b]/15"
              : "border-[#1A2E4F]/15 focus:border-[#EC2456]/55 focus:ring-2 focus:ring-[#EC2456]/10"
          }`}
        />
        <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#1A2E4F]/35" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
      </div>

      {aberto && (
        <ul className="absolute left-0 right-0 top-[calc(100%+4px)] z-30 max-h-64 overflow-y-auto rounded-lg border border-[#1A2E4F]/10 bg-white py-1 shadow-xl">
          {resultados.length === 0 ? (
            <li className="px-3.5 py-3 text-sm text-[#1A2E4F]/50">Sem concelhos para “{termo}”</li>
          ) : (
            resultados.map((c, indice) => (
              <li key={c.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(c)}
                  onMouseEnter={() => setAtivo(indice)}
                  className={`flex w-full cursor-pointer items-center justify-between gap-2 px-3.5 py-2 text-left text-sm transition ${
                    indice === ativo ? "bg-[#EC2456]/[0.07] text-[#EC2456]" : "text-[#102745]"
                  } ${c.id === valor ? "font-bold" : ""}`}
                >
                  <span className="truncate">{c.nome}</span>
                  <span className="shrink-0 text-xs text-[#1A2E4F]/45">{c.distrito}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
