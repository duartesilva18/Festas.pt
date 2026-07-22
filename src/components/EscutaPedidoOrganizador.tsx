"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";

/**
 * Enquanto o pedido de organizador está pendente, ouve a decisão da moderação
 * em tempo real e atualiza a página sozinho — sem F5 e sem sondagem periódica.
 *
 * A RLS da tabela só deixa cada utilizador ver os seus próprios pedidos, e o
 * Realtime aplica-a ao subscrever, por isso ninguém recebe eventos de outros.
 * Fica na mesma uma rede de segurança: se a ligação falhar ou o portátil
 * adormecer, uma verificação ao voltar à aba apanha o que se perdeu.
 */
export default function EscutaPedidoOrganizador({ pedidoId, estadoInicial }: { pedidoId: string; estadoInicial: string }) {
  const router = useRouter();
  const tratado = useRef(false);

  useEffect(() => {
    if (estadoInicial !== "pendente") return;
    tratado.current = false;

    const concluir = () => {
      if (tratado.current) return;
      tratado.current = true;
      router.refresh();
    };

    const supabase = supabaseBrowser();
    const canal = supabase
      .channel(`pedido-organizador:${pedidoId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pedidos_organizador", filter: `id=eq.${pedidoId}` },
        (mensagem) => {
          const novo = mensagem.new as { estado?: string } | null;
          if (novo?.estado && novo.estado !== "pendente") concluir();
        },
      )
      .subscribe();

    // Rede de segurança para eventos perdidos (ligação caída, aba suspensa).
    const aoVoltar = async () => {
      if (document.hidden || tratado.current) return;
      const { data } = await supabase.from("pedidos_organizador").select("estado").eq("id", pedidoId).maybeSingle();
      if (data?.estado && data.estado !== "pendente") concluir();
    };
    document.addEventListener("visibilitychange", aoVoltar);

    return () => {
      tratado.current = true;
      document.removeEventListener("visibilitychange", aoVoltar);
      void supabase.removeChannel(canal);
    };
  }, [pedidoId, estadoInicial, router]);

  return null;
}
