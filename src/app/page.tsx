import Link from "next/link";
import MapaFestas from "@/components/MapaFestas";
import Navbar, { type OpcaoPesquisa } from "@/components/Navbar";
import { fetchFestasGeoJSON } from "@/lib/eventos";

export const revalidate = 300;

const LEGENDA = [
  { cor: "#EC2456", texto: "A decorrer" },
  { cor: "#F97B16", texto: "Nos próximos 7 dias" },
  { cor: "#8B93A7", texto: "Mais tarde" },
] as const;

export default async function Home() {
  const dados = await fetchFestasGeoJSON();
  const opcoesPesquisa: OpcaoPesquisa[] = dados.features.map((festa) => ({
    id: festa.properties.id,
    nome: festa.properties.nome,
    localizacao: [festa.properties.freguesia, festa.properties.concelho, festa.properties.distrito].filter(Boolean).join(" · "),
    cartazUrl: festa.properties.cartaz_url,
  }));

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white">
      <Navbar contagem={dados.features.length} opcoesPesquisa={opcoesPesquisa} />

      <main className="relative z-0 min-h-0 flex-1">
        <MapaFestas dados={dados} />

        <aside className="pointer-events-none absolute bottom-4 right-14 z-10 hidden sm:block">
          <ul className="pointer-events-auto space-y-1.5 rounded-lg bg-white/95 px-4 py-3 shadow-md ring-1 ring-[#1A2E4F]/10 backdrop-blur">
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

      <footer className="z-20 flex h-9 shrink-0 items-center justify-between gap-3 border-t border-[#1A2E4F]/10 bg-white px-4 text-[11px] text-[#1A2E4F]/60 sm:px-6">
        <p className="truncate">
          © {new Date().getFullYear()} Achafestas
          <span className="hidden sm:inline"> · Todos os direitos reservados</span>
        </p>
        <nav className="flex shrink-0 items-center gap-4">
          <span className="hidden lg:inline">Dados verificados com as organizações</span>
          <Link href="/termos" className="hover:text-[#1A2E4F]">Termos</Link>
          <Link href="/privacidade" className="hover:text-[#1A2E4F]">Privacidade</Link>
        </nav>
      </footer>
    </div>
  );
}
