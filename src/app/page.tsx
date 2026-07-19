import Image from "next/image";
import Link from "next/link";
import FestaMap from "@/components/FestaMap";
import { fetchFestasGeoJSON } from "@/lib/eventos";

export const revalidate = 300;

const LEGENDA = [
  { cor: "#E63946", texto: "A decorrer" },
  { cor: "#FFB703", texto: "Nos próximos 7 dias" },
  { cor: "#457B9D", texto: "Mais tarde" },
] as const;

export default async function Home() {
  const dados = await fetchFestasGeoJSON();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white">
      <header className="z-20 flex h-16 shrink-0 items-center justify-between border-b border-[#1A2E4F]/10 bg-white px-4 sm:px-6">
        <Link href="/" className="flex items-center">
          <Image src="/logo.svg" alt="Achafestas" width={188} height={40} priority />
        </Link>

        <nav className="flex items-center gap-2 sm:gap-5">
          <span className="hidden text-sm font-medium text-[#1A2E4F]/70 md:block">
            {dados.features.length} festas no mapa
          </span>
          <button
            type="button"
            className="cursor-not-allowed rounded-full bg-[#EC2456] px-5 py-2 text-sm font-semibold text-white opacity-90 transition hover:opacity-100"
            title="Disponível em breve"
          >
            Entrar
          </button>
        </nav>
      </header>

      <main className="relative z-0 min-h-0 flex-1">
        <FestaMap dados={dados} />

        <aside className="pointer-events-none absolute bottom-4 left-4 z-10">
          <ul className="pointer-events-auto space-y-1.5 rounded-xl bg-white/95 px-4 py-3 shadow-md ring-1 ring-[#1A2E4F]/10 backdrop-blur">
            {LEGENDA.map((item) => (
              <li key={item.texto} className="flex items-center gap-2.5 text-xs font-medium text-[#1A2E4F]">
                <span
                  className="inline-block size-3 rounded-full"
                  style={{ backgroundColor: item.cor }}
                />
                {item.texto}
              </li>
            ))}
          </ul>
        </aside>
      </main>

      <footer className="z-20 flex h-9 shrink-0 items-center justify-between border-t border-[#1A2E4F]/10 bg-white px-4 text-[11px] text-[#1A2E4F]/60 sm:px-6">
        <p>© {new Date().getFullYear()} Achafestas · Todos os direitos reservados</p>
        <nav className="flex items-center gap-4">
          <span className="hidden sm:inline">Dados verificados com as organizações</span>
          <Link href="/termos" className="hover:text-[#1A2E4F]">Termos</Link>
          <Link href="/privacidade" className="hover:text-[#1A2E4F]">Privacidade</Link>
        </nav>
      </footer>
    </div>
  );
}
