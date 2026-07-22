"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * Enquanto o pedido de organizador está "pendente", sonda o servidor de vez em
 * quando e recarrega os dados da página assim que o admin decide — sem o
 * utilizador ter de dar F5 para ver que foi aprovado ou rejeitado.
 */
export default function PoloPedidoOrganizador({ pedidoId, estadoInicial }: { pedidoId: string; estadoInicial: string }) {
  const router = useRouter();
  const parado = useRef(false);

  useEffect(() => {
    if (estadoInicial !== "pendente") return;
    parado.current = false;

    const verificar = async () => {
      if (parado.current || document.hidden) return;
      try {
        const resposta = await fetch("/api/organizador/estado", { cache: "no-store" });
        if (!resposta.ok) return;
        const dados: { pedidoId: string | null; pedidoEstado: string | null } = await resposta.json();
        if (dados.pedidoId === pedidoId && dados.pedidoEstado !== "pendente") {
          parado.current = true;
          router.refresh();
        }
      } catch {
        // Falha de rede: tenta novamente no próximo ciclo.
      }
    };

    const intervalo = window.setInterval(verificar, 15_000);
    document.addEventListener("visibilitychange", verificar);
    return () => {
      parado.current = true;
      window.clearInterval(intervalo);
      document.removeEventListener("visibilitychange", verificar);
    };
  }, [pedidoId, estadoInicial, router]);

  return null;
}
