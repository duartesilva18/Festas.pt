"use client";

import { useEffect } from "react";

export default function Lightbox({
  fotos,
  indice,
  setIndice,
}: {
  fotos: string[];
  indice: number | null;
  setIndice: (i: number | null) => void;
}) {
  useEffect(() => {
    if (indice === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndice(null);
      else if (e.key === "ArrowRight") setIndice((indice + 1) % fotos.length);
      else if (e.key === "ArrowLeft") setIndice((indice - 1 + fotos.length) % fotos.length);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [indice, fotos.length, setIndice]);

  if (indice === null) return null;
  const multi = fotos.length > 1;

  return (
    <div
      onClick={() => setIndice(null)}
      className="lightbox-fade fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => setIndice(null)}
        className="absolute right-4 top-4 flex size-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {multi && (
        <button
          type="button"
          aria-label="Anterior"
          onClick={(e) => { e.stopPropagation(); setIndice((indice - 1 + fotos.length) % fotos.length); }}
          className="absolute left-3 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:left-6"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
        </button>
      )}

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={fotos[indice]}
        alt={`Foto ${indice + 1}`}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[88vh] max-w-[92vw] rounded-md object-contain shadow-2xl"
      />

      {multi && (
        <button
          type="button"
          aria-label="Seguinte"
          onClick={(e) => { e.stopPropagation(); setIndice((indice + 1) % fotos.length); }}
          className="absolute right-3 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 sm:right-6"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7" /></svg>
        </button>
      )}

      {multi && (
        <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white">
          {indice + 1} / {fotos.length}
        </div>
      )}
    </div>
  );
}
