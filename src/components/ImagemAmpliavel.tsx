"use client";

import { useState } from "react";
import Lightbox from "@/components/Lightbox";

export default function ImagemAmpliavel({
  src,
  alt,
  className = "",
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [aberta, setAberta] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="block w-full cursor-zoom-in"
        aria-label="Ver imagem maior"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={className} />
      </button>
      <Lightbox
        fotos={[src]}
        indice={aberta ? 0 : null}
        setIndice={(i) => setAberta(i !== null)}
      />
    </>
  );
}
