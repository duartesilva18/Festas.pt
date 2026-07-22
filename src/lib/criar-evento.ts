export type RecorrenciaEvento = "anual" | "unica" | "fins_de_semana";
export type CategoriaPrincipal =
  | "festa_popular"
  | "musica_noite"
  | "gastronomia"
  | "cultura_artes"
  | "feiras_mercados"
  | "religiao_tradicao"
  | "desporto_aventura"
  | "familia"
  | "academico"
  | "comunidade"
  | "outro";

export type ProgramaRascunho = {
  id: string;
  dia: string;
  hora: string;
  titulo: string;
};

export type ItemTextoRascunho = {
  id: string;
  titulo: string;
  texto: string;
};

export type ContactoRascunho = {
  id: string;
  tipo: "telefone" | "email" | "site" | "rede_social";
  valor: string;
};

export type SublocalizacaoRascunho = {
  id: string;
  nome: string;
  tipo: "estacionamento" | "entrada" | "palco" | "after" | "bar" | "wc" | "primeiros_socorros" | "outro";
  tipoPersonalizado: string;
  descricao: string;
  horario: string;
  acessivel: boolean | null;
  lat: number | null;
  lng: number | null;
};

export type BlocoRascunho = {
  id: string;
  titulo: string;
  texto: string;
};

export type DadosCriarEvento = {
  nome: string;
  recorrencia: RecorrenciaEvento;
  concelhoId: string;
  freguesia: string;
  localNome: string;
  morada: string;
  codigoPostal: string;
  lat: number | null;
  lng: number | null;
  dataInicio: string;
  dataFim: string;
  diasSemana: number[];
  categoriaPrincipal: CategoriaPrincipal | "";
  formatoEvento: string;
  tags: string[];
  subtitulo: string;
  resumo: string;
  descricao: string;
  cartazUrl: string;
  fotos: string[];
  acercaAtivo: boolean;
  acerca: {
    titulo: string;
    introducao: string;
    acessibilidade: string;
    estacionamento: string;
    transportes: string;
    alimentacao: string;
    regras: string;
  };
  programaAtivo: boolean;
  programa: ProgramaRascunho[];
  informacoesAtivas: boolean;
  informacoes: ItemTextoRascunho[];
  contactosAtivos: boolean;
  contactos: ContactoRascunho[];
  sublocalizacoes: SublocalizacaoRascunho[];
  blocosPersonalizados: BlocoRascunho[];
};

export type RascunhoEvento = {
  id: string;
  nome: string;
  dados: DadosCriarEvento;
  versao: number;
  updated_at: string;
};

export const CATEGORIAS_PRINCIPAIS: { valor: CategoriaPrincipal; nome: string; descricao: string }[] = [
  { valor: "festa_popular", nome: "Festa popular", descricao: "Romarias, arraiais e festas locais" },
  { valor: "musica_noite", nome: "Música e noite", descricao: "Sunsets, concertos, DJs e festivais" },
  { valor: "gastronomia", nome: "Gastronomia", descricao: "Comida, vinho e produtos regionais" },
  { valor: "cultura_artes", nome: "Cultura e artes", descricao: "Teatro, exposições e património" },
  { valor: "feiras_mercados", nome: "Feiras e mercados", descricao: "Feiras, mercados e artesanato" },
  { valor: "religiao_tradicao", nome: "Religião e tradição", descricao: "Procissões e celebrações religiosas" },
  { valor: "desporto_aventura", nome: "Desporto e aventura", descricao: "Provas, caminhadas e atividades" },
  { valor: "familia", nome: "Família", descricao: "Atividades infantis e familiares" },
  { valor: "academico", nome: "Académico", descricao: "Queimas, tunas e festas estudantis" },
  { valor: "comunidade", nome: "Comunidade", descricao: "Encontros e iniciativas locais" },
  { valor: "outro", nome: "Outro", descricao: "Qualquer formato que não esteja na lista" },
];

export const FORMATOS_SUGERIDOS = [
  "Sunset",
  "Romaria",
  "Arraial",
  "Festival",
  "Concerto",
  "DJ set",
  "Feira",
  "Mercado",
  "Festa académica",
  "Rave",
  "Procissão",
  "Encontro gastronómico",
] as const;

export function nomeCategoriaPrincipal(valor: string) {
  return CATEGORIAS_PRINCIPAIS.find((categoria) => categoria.valor === valor)?.nome ?? "Evento";
}

export const TIPOS_SUBLOCALIZACAO: { valor: SublocalizacaoRascunho["tipo"]; nome: string; curto: string }[] = [
  { valor: "estacionamento", nome: "Estacionamento", curto: "P" },
  { valor: "entrada", nome: "Entrada", curto: "→" },
  { valor: "wc", nome: "Casas de banho", curto: "WC" },
  { valor: "palco", nome: "Palco", curto: "♫" },
  { valor: "after", nome: "After", curto: "♫" },
  { valor: "bar", nome: "Bar / comida", curto: "B" },
  { valor: "primeiros_socorros", nome: "Primeiros socorros", curto: "+" },
  { valor: "outro", nome: "Outro", curto: "•" },
];

export const DADOS_EVENTO_VAZIOS: DadosCriarEvento = {
  nome: "",
  recorrencia: "anual",
  concelhoId: "",
  freguesia: "",
  localNome: "",
  morada: "",
  codigoPostal: "",
  lat: null,
  lng: null,
  dataInicio: "",
  dataFim: "",
  diasSemana: [6, 7],
  categoriaPrincipal: "",
  formatoEvento: "",
  tags: [],
  subtitulo: "",
  resumo: "",
  descricao: "",
  cartazUrl: "",
  fotos: [],
  acercaAtivo: false,
  acerca: {
    titulo: "Acerca da festa",
    introducao: "",
    acessibilidade: "",
    estacionamento: "",
    transportes: "",
    alimentacao: "",
    regras: "",
  },
  programaAtivo: false,
  programa: [],
  informacoesAtivas: false,
  informacoes: [],
  contactosAtivos: false,
  contactos: [],
  sublocalizacoes: [],
  blocosPersonalizados: [],
};

function lista<T>(valor: unknown): T[] {
  return Array.isArray(valor) ? valor as T[] : [];
}

export function normalizarDadosEvento(valor: unknown): DadosCriarEvento {
  if (!valor || typeof valor !== "object") return structuredClone(DADOS_EVENTO_VAZIOS);
  const dados = valor as Partial<DadosCriarEvento>;
  const legado = lista<string>((valor as { categorias?: unknown }).categorias);
  const categoriaLegada: CategoriaPrincipal | "" = legado.includes("Música") ? "musica_noite"
    : legado.includes("Gastronomia") ? "gastronomia"
      : legado.includes("Feira") ? "feiras_mercados"
        : legado.includes("Religiosa") ? "religiao_tradicao"
          : legado.includes("Família") ? "familia"
            : legado.length ? "festa_popular" : "";
  return {
    ...structuredClone(DADOS_EVENTO_VAZIOS),
    ...dados,
    recorrencia: dados.recorrencia === "unica" || dados.recorrencia === "fins_de_semana" ? dados.recorrencia : "anual",
    diasSemana: (dados.diasSemana === undefined ? [6, 7] : lista<number>(dados.diasSemana))
      .filter((dia) => Number.isInteger(dia) && dia >= 5 && dia <= 7)
      .filter((dia, indice, dias) => dias.indexOf(dia) === indice)
      .sort(),
    categoriaPrincipal: dados.categoriaPrincipal || categoriaLegada,
    formatoEvento: typeof dados.formatoEvento === "string" ? dados.formatoEvento : (legado[0] ?? ""),
    tags: lista<string>(dados.tags),
    fotos: lista<string>(dados.fotos),
    programa: lista<ProgramaRascunho>(dados.programa),
    informacoes: lista<ItemTextoRascunho>(dados.informacoes),
    contactos: lista<ContactoRascunho>(dados.contactos),
    sublocalizacoes: lista<SublocalizacaoRascunho>(dados.sublocalizacoes),
    blocosPersonalizados: lista<BlocoRascunho>(dados.blocosPersonalizados),
    acerca: { ...DADOS_EVENTO_VAZIOS.acerca, ...(dados.acerca ?? {}) },
  };
}

export function novoId(prefixo: string) {
  return `${prefixo}_${crypto.randomUUID()}`;
}
