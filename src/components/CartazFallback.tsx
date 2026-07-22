import { nomeCategoriaPrincipal } from "@/lib/criar-evento";

const ESTILOS: Record<string, { fundo: string; cor: string; icone: string }> = {
  festa_popular: { fundo: "from-[#FFF3E8] to-[#FCE8EE]", cor: "text-[#C91F4D]", icone: "M4 19h16M6 16l2-9 4 5 4-8 2 12M8 7l-2-3M16 4l2-2" },
  musica_noite: { fundo: "from-[#EEEAF5] to-[#F8EAF0]", cor: "text-[#70429B]", icone: "M9 18V6l10-2v12M6 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm10-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" },
  gastronomia: { fundo: "from-[#FFF4E8] to-[#F8EDE2]", cor: "text-[#A95527]", icone: "M5 3v7a3 3 0 0 0 3 3V3M6.5 3v18M18 3c-2 0-3 3-3 6s1 4 3 4v8" },
  cultura_artes: { fundo: "from-[#EAF2F1] to-[#F2EDF4]", cor: "text-[#436F69]", icone: "M4 18 14 8l4 4L8 22H4v-4ZM13 5l2-2 6 6-2 2" },
  feiras_mercados: { fundo: "from-[#EEF3E8] to-[#F7F1E8]", cor: "text-[#62733C]", icone: "M3 9h18l-2-5H5L3 9Zm2 0v11h14V9M9 13h6" },
  religiao_tradicao: { fundo: "from-[#F2EEE8] to-[#F8F3EA]", cor: "text-[#796443]", icone: "M12 2v7M9 5h6M6 22V11l6-3 6 3v11M9 22v-5h6v5" },
  desporto_aventura: { fundo: "from-[#E8F2F3] to-[#EDF3EA]", cor: "text-[#237486]", icone: "M4 17c4-1 5-9 9-9 3 0 4 3 7 3M8 7l3-3 3 3M4 21h16" },
  familia: { fundo: "from-[#FFF2EB] to-[#F4EEF5]", cor: "text-[#9C5278]", icone: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM3 21v-3a5 5 0 0 1 10 0v3M13 21v-2a4 4 0 0 1 8 0v2" },
};

export default function CartazFallback({
  nome,
  categoria,
  className = "h-full w-full",
  mostrarNome = false,
}: {
  nome: string;
  categoria: string;
  className?: string;
  mostrarNome?: boolean;
}) {
  const estilo = ESTILOS[categoria] ?? { fundo: "from-[#EEF1F5] to-[#F7F3F0]", cor: "text-[#516078]", icone: "M12 21s-7-6-7-11a7 7 0 1 1 14 0c0 5-7 11-7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" };
  return (
    <div className={`relative flex overflow-hidden bg-gradient-to-br ${estilo.fundo} ${className}`}>
      <svg aria-hidden="true" className={`absolute -right-5 -top-7 size-36 opacity-[0.08] ${estilo.cor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"><path d={estilo.icone} /></svg>
      <div className="relative flex min-w-0 flex-1 items-center gap-3 p-4">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-full bg-white/75 shadow-sm ${estilo.cor}`}>
          <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={estilo.icone} /></svg>
        </span>
        <span className="min-w-0">
          <span className={`block text-[10px] font-bold uppercase tracking-[0.12em] ${estilo.cor}`}>{nomeCategoriaPrincipal(categoria)}</span>
          {mostrarNome && <span className="mt-1 block line-clamp-2 text-sm font-bold leading-snug text-[#102745]">{nome}</span>}
        </span>
      </div>
    </div>
  );
}
