"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ModerarEvento({ edicaoId }: { edicaoId: string }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [aEnviar, setAEnviar] = useState<"aprovar" | "rejeitar" | null>(null);
  const [erro, setErro] = useState("");

  const moderar = async (acao: "aprovar" | "rejeitar") => {
    if (acao === "rejeitar" && nota.trim().length < 5) {
      setErro("Escreve uma nota a explicar o motivo da rejeição.");
      return;
    }
    setAEnviar(acao);
    setErro("");
    try {
      const resposta = await fetch("/api/admin/eventos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: edicaoId, acao, nota }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        throw new Error(dados?.error ?? "Não foi possível moderar.");
      }
      router.refresh();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível moderar.");
      setAEnviar(null);
    }
  };

  return (
    <div>
      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        maxLength={500}
        placeholder="Nota para o organizador (obrigatória se rejeitares)"
        className="w-full rounded-lg border border-[#1A2E4F]/15 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-[#EC2456]"
      />
      <div className="mt-2.5 flex gap-2">
        <button
          type="button"
          onClick={() => moderar("aprovar")}
          disabled={aEnviar !== null}
          className="flex items-center gap-1.5 rounded-lg bg-[#20856D] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#1a6f5b] disabled:cursor-wait disabled:opacity-60"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
          {aEnviar === "aprovar" ? "A publicar…" : "Aprovar e publicar"}
        </button>
        <button
          type="button"
          onClick={() => moderar("rejeitar")}
          disabled={aEnviar !== null}
          className="flex items-center gap-1.5 rounded-lg border border-[#c43d4b]/30 px-3.5 py-2 text-xs font-bold text-[#c43d4b] transition hover:bg-[#c43d4b]/[0.06] disabled:cursor-wait disabled:opacity-60"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          {aEnviar === "rejeitar" ? "A rejeitar…" : "Rejeitar"}
        </button>
      </div>
      {erro && <p role="alert" className="mt-2 text-xs font-semibold text-[#c43d4b]">{erro}</p>}
    </div>
  );
}
