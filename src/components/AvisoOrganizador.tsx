"use client";

import { useEffect, useState } from "react";

export default function AvisoOrganizador({ userId, pedidoId }: { userId: string; pedidoId: string }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const chave = `achafestas:aviso-organizador:${userId}:${pedidoId}`;
    try {
      if (window.localStorage.getItem(chave)) return;
    } catch {}

    const frame = window.requestAnimationFrame(() => {
      try {
        window.localStorage.setItem(chave, "mostrado");
      } catch {}
      setVisivel(true);
    });
    const temporizador = window.setTimeout(() => setVisivel(false), 4_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(temporizador);
    };
  }, [pedidoId, userId]);

  if (!visivel) return null;

  return (
    <div role="status" aria-live="polite" className="mt-4 flex items-center gap-3 rounded-xl border border-[#20856D]/20 bg-[#20856D]/[0.05] p-4">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#20856D" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3z" /><path d="m9 12 2 2 4-4" /></svg>
      <div>
        <p className="text-sm font-bold text-[#102745]">Conta verificada como organizador</p>
        <p className="mt-0.5 text-xs text-[#1A2E4F]/60">Em breve vais poder publicar as festas da tua entidade.</p>
      </div>
    </div>
  );
}
