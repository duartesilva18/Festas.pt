"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EstadoEventoOrganizador({
  edicaoId,
  cancelado,
}: {
  edicaoId: string;
  cancelado: boolean;
}) {
  const router = useRouter();
  const [aConfirmar, setAConfirmar] = useState(false);
  const [aEnviar, setAEnviar] = useState(false);
  const [erro, setErro] = useState("");

  const alterar = async (acao: "cancelar" | "reativar") => {
    setAEnviar(true);
    setErro("");
    try {
      const resposta = await fetch("/api/organizador/eventos/estado", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ edicaoId, acao }),
      });
      if (!resposta.ok) {
        const dados = await resposta.json().catch(() => null);
        throw new Error(dados?.error ?? "Não foi possível atualizar.");
      }
      setAConfirmar(false);
      router.refresh();
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível atualizar.");
    } finally {
      setAEnviar(false);
    }
  };

  if (cancelado) {
    return (
      <button
        type="button"
        disabled={aEnviar}
        onClick={() => void alterar("reativar")}
        className="cursor-pointer text-[#20856D] transition hover:text-[#1a6f5b] disabled:cursor-wait disabled:opacity-60"
      >
        {aEnviar ? "A reativar…" : "Reativar"}
      </button>
    );
  }

  if (aConfirmar) {
    return (
      <span className="flex items-center gap-2">
        <button
          type="button"
          disabled={aEnviar}
          onClick={() => void alterar("cancelar")}
          className="cursor-pointer text-[#c43d4b] transition hover:text-[#a32f3c] disabled:cursor-wait disabled:opacity-60"
        >
          {aEnviar ? "A cancelar…" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => { setAConfirmar(false); setErro(""); }}
          className="cursor-pointer text-[#1A2E4F]/50 transition hover:text-[#1A2E4F]"
        >
          Não
        </button>
        {erro && <span className="text-[10px] font-normal text-[#c43d4b]">{erro}</span>}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setAConfirmar(true)}
      className="cursor-pointer text-[#1A2E4F]/65 transition hover:text-[#c43d4b]"
    >
      Cancelar
    </button>
  );
}
