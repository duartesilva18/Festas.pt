"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";

/**
 * Faixa fixa por baixo da navbar a dizer que as entidades podem publicar aqui.
 * Sem isto ninguém descobre a funcionalidade. Desaparece assim que a conta já
 * é organizadora — a partir daí o convite passa a ser ruído.
 */
export default function ConviteOrganizador() {
  const { utilizador, papel, aCarregar, entrarComGoogle } = useAuth();

  if (aCarregar || papel === "organizador" || papel === "admin") return null;

  return (
    <div className="z-20 flex shrink-0 items-center justify-center gap-2 border-b border-[#EC2456]/12 bg-gradient-to-r from-[#F97B16]/[0.07] to-[#EC2456]/[0.07] px-4 py-1.5 text-center">
      <span className="shrink-0 text-[#EC2456]">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3 4 6v6c0 4.4 3.4 8.4 8 9 4.6-.6 8-4.6 8-9V6l-8-3z" />
        </svg>
      </span>
      <p className="truncate text-[11.5px] font-semibold text-[#102745] sm:text-xs">
        Organizas festas?
        <span className="hidden font-normal text-[#1A2E4F]/60 sm:inline"> Juntas de freguesia, comissões e associações publicam aqui as suas festas.</span>
      </p>
      {utilizador ? (
        <Link href="/perfil#organizador" className="shrink-0 text-[11.5px] font-bold text-[#EC2456] underline-offset-2 transition hover:underline sm:text-xs">
          Pedir verificação →
        </Link>
      ) : (
        <button type="button" onClick={entrarComGoogle} className="shrink-0 cursor-pointer text-[11.5px] font-bold text-[#EC2456] underline-offset-2 transition hover:underline sm:text-xs">
          Publicar as minhas festas →
        </button>
      )}
    </div>
  );
}
