"use client";

import { useState } from "react";
import Lightbox from "@/components/Lightbox";

export default function Galeria({
  fotos,
  variante = "pagina",
}: {
  fotos: string[];
  variante?: "pagina" | "painel";
}) {
  const [indice, setIndice] = useState<number | null>(null);
  const grid =
    variante === "painel" ? "grid-cols-2 gap-1.5" : "grid-cols-2 gap-2 sm:grid-cols-3";
  const aspecto = variante === "painel" ? "aspect-[4/3]" : "aspect-square";

  return (
    <>
      <div className={`grid ${grid}`}>
        {fotos.map((foto, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIndice(i)}
            className="group overflow-hidden rounded-md"
            aria-label={`Ver foto ${i + 1} maior`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={foto}
              alt={`Foto ${i + 1}`}
              className={`${aspecto} w-full cursor-zoom-in object-cover transition duration-300 group-hover:scale-105`}
            />
          </button>
        ))}
      </div>
      <Lightbox fotos={fotos} indice={indice} setIndice={setIndice} />
    </>
  );
}
