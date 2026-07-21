"use client";

import { useRouter } from "next/navigation";

export default function BotaoVoltar({ className = "" }: { className?: string }) {
  const router = useRouter();

  function voltar() {
    if (window.history.length > 1) router.back();
    else router.push("/");
  }

  return (
    <button
      type="button"
      onClick={voltar}
      aria-label="Voltar atrás"
      className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-[#1A2E4F]/15 text-[#1A2E4F]/70 transition hover:border-[#1A2E4F]/30 hover:bg-[#1A2E4F]/[0.04] hover:text-[#1A2E4F] ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}
