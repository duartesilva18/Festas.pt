import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MapaFestas from "@/components/MapaFestas";
import Navbar, { type OpcaoPesquisa } from "@/components/Navbar";
import { fetchFestasGeoJSON } from "@/lib/eventos";
import { formatarLocalizacao } from "@/lib/festa-ui";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const dados = await fetchFestasGeoJSON();
  const festa = dados.features.find((item) => item.properties.concelho_slug === slug);
  if (!festa) return { title: "Concelho não encontrado | Achafestas" };
  return {
    title: `Festas em ${festa.properties.concelho} | Achafestas`,
    description: `Descobre festas e eventos em ${festa.properties.concelho}, ${festa.properties.distrito}.`,
  };
}

export default async function PaginaConcelho({ params }: Props) {
  const { slug } = await params;
  const todos = await fetchFestasGeoJSON();
  const features = todos.features.filter((item) => item.properties.concelho_slug === slug);
  if (features.length === 0) notFound();
  const dados = { ...todos, features };
  const opcoesPesquisa: OpcaoPesquisa[] = features.map((festa) => ({
    id: festa.properties.id,
    nome: festa.properties.nome,
    localizacao: formatarLocalizacao(festa.properties.freguesia, festa.properties.concelho, festa.properties.distrito),
    cartazUrl: festa.properties.cartaz_url,
  }));
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-white">
      <Navbar contagem={features.length} opcoesPesquisa={opcoesPesquisa} />
      <main className="relative min-h-0 flex-1"><MapaFestas dados={dados} /></main>
    </div>
  );
}
