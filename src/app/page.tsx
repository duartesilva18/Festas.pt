import Link from "next/link";
import MapaFestas from "@/components/MapaFestas";
import Navbar, { type OpcaoPesquisa } from "@/components/Navbar";
import { fetchFestasGeoJSON } from "@/lib/eventos";
import { formatarLocalizacao } from "@/lib/festa-ui";

export const revalidate = 300;

export default async function Home() {
  const dados = await fetchFestasGeoJSON();
  const opcoesPesquisa: OpcaoPesquisa[] = dados.features.map((festa) => ({
    id: festa.properties.id,
    nome: festa.properties.nome,
    localizacao: formatarLocalizacao(festa.properties.freguesia, festa.properties.concelho, festa.properties.distrito),
    cartazUrl: festa.properties.cartaz_url,
  }));

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white">
      <Navbar contagem={dados.features.length} opcoesPesquisa={opcoesPesquisa} />

      <main className="relative z-0 min-h-0 flex-1">
        <MapaFestas dados={dados} />
      </main>

      <footer className="z-20 flex h-9 shrink-0 items-center justify-between gap-3 border-t border-[#1A2E4F]/10 bg-white px-4 text-[11px] text-[#1A2E4F]/60 sm:px-6">
        <p className="truncate">
          © {new Date().getFullYear()} Achafestas
          <span className="hidden sm:inline"> · Todos os direitos reservados</span>
        </p>
        <nav className="flex shrink-0 items-center gap-4">
          <span className="hidden lg:inline">Dados verificados com as organizações</span>
          <Link href="/ajuda" className="hover:text-[#1A2E4F]">Ajuda</Link>
          <Link href="/termos" className="hover:text-[#1A2E4F]">Termos</Link>
          <Link href="/privacidade" className="hover:text-[#1A2E4F]">Privacidade</Link>
        </nav>
      </footer>
    </div>
  );
}
