import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Um evento mudou: publicado, corrigido, cancelado ou reativado.
 *
 * Sem isto, as páginas ficavam servidas de cache até 1 hora — uma correção
 * urgente do organizador só chegaria ao público muito depois de a fazer.
 */
export function revalidarEvento(concelhoSlug?: string | null, festaSlug?: string | null) {
  // Dados: o mapa e a ficha da festa partilham a tag "festas".
  // expire: 0 — sem janela de conteúdo obsoleto; o pedido seguinte já traz o
  // conteúdo novo, que é o ponto de uma correção urgente.
  const imediato = { expire: 0 };
  revalidateTag("festas", imediato);
  if (concelhoSlug && festaSlug) revalidateTag(`festa:${concelhoSlug}/${festaSlug}`, imediato);

  // Páginas renderizadas.
  revalidatePath("/");
  revalidatePath("/sitemap.xml");
  if (concelhoSlug) revalidatePath(`/concelhos/${concelhoSlug}`);
  if (concelhoSlug && festaSlug) {
    revalidatePath(`/festas/${concelhoSlug}/${festaSlug}`);
    revalidatePath(`/festas/${concelhoSlug}/${festaSlug}/calendario.ics`);
  }
}
