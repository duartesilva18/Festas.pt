export type TipoSublocalizacaoMapa =
  | "estacionamento"
  | "entrada"
  | "palco"
  | "after"
  | "bar"
  | "wc"
  | "primeiros_socorros"
  | "outro";

export const PIN_RECINTO: Record<TipoSublocalizacaoMapa, { cor: string; descricao: string }> = {
  estacionamento: { cor: "#2B6CB0", descricao: "Estacionamento" },
  entrada: { cor: "#20856D", descricao: "Entrada" },
  palco: { cor: "#7C4DAD", descricao: "Palco" },
  after: { cor: "#5E3A9E", descricao: "After" },
  bar: { cor: "#B75B25", descricao: "Bar" },
  wc: { cor: "#167F99", descricao: "Casas de banho" },
  primeiros_socorros: { cor: "#C43D4B", descricao: "Primeiros socorros" },
  outro: { cor: "#64748B", descricao: "Ponto no recinto" },
};

const ICONES_RECINTO: Record<TipoSublocalizacaoMapa, string> = {
  estacionamento: '<path d="M8 19V5h5.2a4.2 4.2 0 0 1 0 8.4H8"/><path d="M8 13.4h5.2"/>',
  entrada: '<path d="M4 12h11"/><path d="m11 7 5 5-5 5"/><path d="M18 4h2v16h-2"/>',
  palco: '<path d="M8.5 18V6l10-2v12"/><circle cx="6" cy="18" r="2.5"/><circle cx="16" cy="16" r="2.5"/>',
  after: '<path d="M17.5 15.5A7 7 0 0 1 8.5 6a7 7 0 1 0 9 9.5Z"/><path d="M16 4v3M14.5 5.5h3"/>',
  bar: '<path d="M6 4h12l-1.5 7a4.6 4.6 0 0 1-9 0L6 4Z"/><path d="M12 16v4M8.5 20h7"/>',
  wc: '<text x="12" y="15.2" text-anchor="middle" fill="currentColor" stroke="none" font-family="system-ui,sans-serif" font-size="8.5" font-weight="850">WC</text>',
  primeiros_socorros: '<path d="M12 5v14M5 12h14"/>',
  outro: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="7"/>',
};

export function tipoSublocalizacao(tipo: string): TipoSublocalizacaoMapa {
  return tipo in PIN_RECINTO ? tipo as TipoSublocalizacaoMapa : "outro";
}

export function iconeRecintoSVG(tipo: string): string {
  const tipoSeguro = tipoSublocalizacao(tipo);
  return `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONES_RECINTO[tipoSeguro]}</svg>`;
}

/**
 * Pin simples, pensado para continuar legivel entre 30 e 48 px.
 * As bandeirinhas identificam uma festa sem prender o simbolo a um formato.
 */
export function pinFestaSVG(cor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 72" width="256" height="288">
    <defs><filter id="s" x="-35%" y="-25%" width="170%" height="170%"><feDropShadow dx="0" dy="2.2" stdDeviation="2.3" flood-color="#102745" flood-opacity=".28"/></filter></defs>
    <g filter="url(#s)">
      <path d="M32 3.5C16.9 3.5 6 14.4 6 28.8c0 16.7 18.6 33 24 38.2a2.9 2.9 0 0 0 4 0c5.4-5.2 24-21.5 24-38.2C58 14.4 47.1 3.5 32 3.5Z" fill="${cor}" stroke="#fff" stroke-width="3"/>
      <circle cx="32" cy="28" r="16" fill="#fff"/>
      <path d="M20 22h24" fill="none" stroke="${cor}" stroke-width="2.4" stroke-linecap="round"/>
      <path d="m22 22 6 0-3 7.5L22 22Zm7 0h6l-3 9-3-9Zm7 0h6l-3 7.5-3-7.5Z" fill="${cor}"/>
    </g>
  </svg>`;
}

export function pinGrupoSVG(cor = "#EC2456"): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 76 72" width="304" height="288">
    <defs><filter id="s" x="-25%" y="-20%" width="150%" height="155%"><feDropShadow dx="0" dy="2.2" stdDeviation="2.2" flood-color="#102745" flood-opacity=".3"/></filter></defs>
    <g filter="url(#s)" stroke="#fff" stroke-linejoin="round">
      <path d="M20 5.5C11.7 5.5 5.5 11.7 5.5 19.7c0 9.2 10.1 18.2 13.2 21a1.9 1.9 0 0 0 2.6 0c3.1-2.8 13.2-11.8 13.2-21 0-8-6.2-14.2-14.5-14.2Z" fill="#F47A1F" stroke-width="2.5"/>
      <circle cx="20" cy="19.5" r="5" fill="#fff" stroke="none" fill-opacity=".92"/>
      <path d="M56 5.5c-8.3 0-14.5 6.2-14.5 14.2 0 9.2 10.1 18.2 13.2 21a1.9 1.9 0 0 0 2.6 0c3.1-2.8 13.2-11.8 13.2-21 0-8-6.2-14.2-14.5-14.2Z" fill="#102745" stroke-width="2.5"/>
      <circle cx="56" cy="19.5" r="5" fill="#fff" stroke="none" fill-opacity=".92"/>
      <path d="M38 9.5c-13.2 0-23 9.5-23 22.1 0 14.5 15.8 28.1 21.1 32.8a2.8 2.8 0 0 0 3.8 0C45.2 59.7 61 46.1 61 31.6 61 19 51.2 9.5 38 9.5Z" fill="${cor}" stroke-width="3.2"/>
      <circle cx="38" cy="31" r="14.6" fill="none" stroke-width="1.4" stroke-opacity=".2"/>
    </g>
  </svg>`;
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function criarElementoSublocalizacao(
  tipo: string,
  nome: string,
  opcoes: { ativo?: boolean; interativo?: boolean } = {},
): HTMLButtonElement {
  const tipoSeguro = tipoSublocalizacao(tipo);
  const configuracao = PIN_RECINTO[tipoSeguro];
  const elemento = document.createElement("button");
  elemento.type = "button";
  elemento.className = `mapa-sublocalizacao${opcoes.ativo ? " mapa-sublocalizacao-ativa" : ""}`;
  elemento.dataset.tipo = tipoSeguro;
  elemento.style.setProperty("--pin-cor", configuracao.cor);

  if (opcoes.interativo === false) {
    elemento.tabIndex = -1;
    elemento.setAttribute("aria-hidden", "true");
  } else {
    elemento.setAttribute("aria-label", `${configuracao.descricao}: ${nome}`);
    elemento.setAttribute("title", `${configuracao.descricao}: ${nome}`);
  }

  const icone = document.createElement("span");
  icone.className = "mapa-sublocalizacao-icone";
  icone.innerHTML = iconeRecintoSVG(tipoSeguro);
  elemento.append(icone);
  return elemento;
}
