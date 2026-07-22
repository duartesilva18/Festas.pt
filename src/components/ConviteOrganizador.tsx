"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

const CHAVE = "achafestas:convite-organizador";

/**
 * Dica discreta no mapa para quem organiza festas — sem ela, ninguém descobre
 * que é possível publicar aqui. Só aparece a quem ainda não é organizador,
 * ao fim de uns segundos, e desaparece de vez quando é dispensada.
 */
export default function ConviteOrganizador() {
  const { utilizador, papel, aCarregar, entrarComGoogle } = useAuth();
  const [visivel, setVisivel] = useState(false);

  const jaOrganiza = papel === "organizador" || papel === "admin";

  useEffect(() => {
    if (aCarregar || jaOrganiza) return;
    try {
      if (window.localStorage.getItem(CHAVE)) return;
    } catch {}
    const temporizador = window.setTimeout(() => setVisivel(true), 3_000);
    return () => window.clearTimeout(temporizador);
  }, [aCarregar, jaOrganiza]);

  function dispensar() {
    try {
      window.localStorage.setItem(CHAVE, "dispensado");
    } catch {}
    setVisivel(false);
  }

  if (!visivel || jaOrganiza) return null;

  return (
    <div className="convite-entrada pointer-events-auto absolute bottom-4 right-4 z-[6] hidden max-w-[19rem] items-start gap-2.5 rounded-lg bg-white/97 px-3.5 py-3 shadow-lg ring-1 ring-[#1A2E4F]/10 backdrop-blur sm:flex">
      <span className="mt-0.5 shrink-0 text-[#EC2456]">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3z" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-[13px] font-bold leading-snug text-[#102745]">Organizas festas?</p>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[#1A2E4F]/60">
          {utilizador
            ? "Pede a verificação da tua entidade para publicares as tuas festas no mapa."
            : "Juntas de freguesia, comissões e associações podem publicar as suas festas aqui."}
        </p>
        {utilizador ? (
          <Link
            href="/perfil#organizador"
            onClick={dispensar}
            className="mt-1.5 inline-block text-[11px] font-bold text-[#EC2456] transition hover:text-[#d11a47]"
          >
            Pedir verificação →
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => { dispensar(); entrarComGoogle(); }}
            className="mt-1.5 cursor-pointer text-[11px] font-bold text-[#EC2456] transition hover:text-[#d11a47]"
          >
            Entrar para publicar →
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={dispensar}
        aria-label="Dispensar"
        className="-mr-1 -mt-1 shrink-0 cursor-pointer rounded p-1 text-[#1A2E4F]/35 transition hover:text-[#1A2E4F]"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
    </div>
  );
}
