import type { MetadataRoute } from "next";
import { fetchFestasGeoJSON } from "@/lib/eventos";

export const revalidate = 3600;

const BASE = "https://achafestas.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const agora = new Date();
  const estaticas: MetadataRoute.Sitemap = [
    { url: BASE, lastModified: agora, changeFrequency: "daily", priority: 1 },
    { url: `${BASE}/ajuda`, lastModified: agora, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/termos`, lastModified: agora, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacidade`, lastModified: agora, changeFrequency: "yearly", priority: 0.2 },
  ];

  // Só entram festas confirmadas — é exatamente o que a view do mapa devolve.
  let dados;
  try {
    dados = await fetchFestasGeoJSON();
  } catch {
    return estaticas;
  }

  const concelhos = new Map<string, Date>();
  const festas: MetadataRoute.Sitemap = [];
  for (const festa of dados.features) {
    const { concelho_slug: concelhoSlug, slug, updated_at: atualizado } = festa.properties as {
      concelho_slug?: string; slug?: string; updated_at?: string;
    };
    if (!concelhoSlug || !slug) continue;
    const data = atualizado ? new Date(atualizado) : agora;
    const valida = Number.isNaN(data.getTime()) ? agora : data;
    if (!concelhos.has(concelhoSlug)) concelhos.set(concelhoSlug, valida);
    festas.push({
      url: `${BASE}/festas/${concelhoSlug}/${slug}`,
      lastModified: valida,
      changeFrequency: "weekly",
      priority: 0.8,
    });
  }

  const paginasConcelho: MetadataRoute.Sitemap = [...concelhos].map(([slug, data]) => ({
    url: `${BASE}/concelhos/${slug}`,
    lastModified: data,
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...estaticas, ...paginasConcelho, ...festas];
}
