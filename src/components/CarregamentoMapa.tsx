/**
 * Ecrã de carregamento do mapa.
 *
 * Usado em dois momentos que o utilizador vê como um só: enquanto o bundle do
 * MapLibre é descarregado, e depois enquanto o mapa monta o estilo e desenha os
 * pins. Sem isto, a primeira visita mostra um retângulo vazio durante segundos.
 */
export default function CarregamentoMapa({ aDesaparecer = false }: { aDesaparecer?: boolean }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`absolute inset-0 z-[7] flex flex-col items-center justify-center gap-3 bg-[#e9effa] transition-opacity duration-300 ${
        aDesaparecer ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <span className="relative flex size-9 items-center justify-center">
        <svg className="size-9 animate-spin" viewBox="0 0 44 44" fill="none" aria-hidden="true">
          <circle cx="22" cy="22" r="19" stroke="#1A2E4F" strokeOpacity="0.12" strokeWidth="4" />
          <path d="M41 22a19 19 0 0 0-19-19" stroke="#EC2456" strokeWidth="4" strokeLinecap="round" />
        </svg>
      </span>
      <p className="text-xs font-bold text-[#1A2E4F]/55">A carregar o mapa…</p>
    </div>
  );
}
