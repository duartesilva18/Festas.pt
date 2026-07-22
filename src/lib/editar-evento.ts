import { DADOS_EVENTO_VAZIOS, type DadosCriarEvento, type CategoriaPrincipal } from "@/lib/criar-evento";

// A localização PostGIS chega da API REST como EWKB hexadecimal.
export function pontoDeEWKB(hex: string | null): { lat: number; lng: number } | null {
  if (!hex || hex.length < 42 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return null;
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  const vista = new DataView(bytes.buffer);
  const le = bytes[0] === 1;
  const tipo = vista.getUint32(1, le);
  const deslocamento = 5 + ((tipo & 0x20000000) !== 0 ? 4 : 0);
  if (bytes.byteLength < deslocamento + 16) return null;
  const lng = vista.getFloat64(deslocamento, le);
  const lat = vista.getFloat64(deslocamento + 8, le);
  return Number.isFinite(lng) && Number.isFinite(lat) ? { lat, lng } : null;
}

type ProgramaDia = { dia: string; eventos: { hora?: string; titulo: string }[] };

export type EdicaoParaEditar = {
  id: string;
  data_inicio: string;
  data_fim: string | null;
  padrao_recorrencia: string;
  dias_semana: number[] | null;
  subtitulo: string | null;
  resumo: string | null;
  descricao: string | null;
  cartaz_url: string | null;
  fotos: string[] | null;
  programa: ProgramaDia[] | null;
  acerca_de: Record<string, unknown> | null;
  informacoes_uteis: { titulo?: string; texto?: string }[] | null;
  contactos: { tipo?: string; valor?: string }[] | null;
  configuracao_card: Record<string, unknown> | null;
  festas: {
    nome: string;
    concelho_id: string;
    freguesia: string | null;
    descricao: string | null;
    location: string | null;
    categoria_principal: string | null;
    formato_evento: string | null;
    tags_evento: string[] | null;
    tipo_recorrencia: string | null;
    local_nome: string | null;
    morada: string | null;
    codigo_postal: string | null;
  } | null;
  edicoes_sublocalizacoes: {
    nome: string;
    tipo: string;
    tipo_personalizado: string | null;
    descricao: string | null;
    horario: string | null;
    acessivel: boolean | null;
    location: string | null;
    ordem: number | null;
  }[] | null;
  edicoes_blocos: {
    chave: string;
    tipo: string;
    titulo: string | null;
    conteudo: Record<string, unknown> | null;
    ordem: number | null;
  }[] | null;
};

function id(prefixo: string) {
  return `${prefixo}_${crypto.randomUUID()}`;
}

function texto(valor: unknown): string {
  return typeof valor === "string" ? valor : "";
}

function ativo(config: Record<string, unknown> | null, chave: string, temConteudo: boolean) {
  const valor = config?.[chave];
  return typeof valor === "boolean" ? valor : temConteudo;
}

/**
 * Converte um evento já guardado na forma que o formulário usa.
 * `manterDatas = false` limpa as datas (usado ao duplicar para uma nova edição).
 */
export function dadosDoEvento(edicao: EdicaoParaEditar, manterDatas = true): DadosCriarEvento {
  const festa = edicao.festas;
  const ponto = pontoDeEWKB(festa?.location ?? null);
  const acercaGuardada = (edicao.acerca_de ?? {}) as Record<string, string | undefined>;
  const blocos = edicao.edicoes_blocos ?? [];

  const programa = (edicao.programa ?? []).flatMap((dia) =>
    (dia?.eventos ?? []).map((item) => ({
      id: id("programa"),
      dia: manterDatas ? texto(dia.dia) : "",
      hora: texto(item?.hora),
      titulo: texto(item?.titulo),
    })),
  );

  const informacoes = (edicao.informacoes_uteis ?? []).map((item) => ({
    id: id("info"),
    titulo: texto(item?.titulo),
    texto: texto(item?.texto),
  }));

  const contactos = (edicao.contactos ?? [])
    .filter((item) => ["telefone", "email", "site", "rede_social"].includes(texto(item?.tipo)))
    .map((item) => ({
      id: id("contacto"),
      tipo: texto(item?.tipo) as "telefone" | "email" | "site" | "rede_social",
      valor: texto(item?.valor),
    }));

  const sublocalizacoes = (edicao.edicoes_sublocalizacoes ?? [])
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .flatMap((local) => {
      const p = pontoDeEWKB(local.location);
      return p ? [{
        id: id("local"),
        nome: texto(local.nome),
        tipo: texto(local.tipo) as DadosCriarEvento["sublocalizacoes"][number]["tipo"],
        tipoPersonalizado: texto(local.tipo_personalizado),
        descricao: texto(local.descricao),
        horario: texto(local.horario),
        acessivel: typeof local.acessivel === "boolean" ? local.acessivel : null,
        lat: p.lat,
        lng: p.lng,
      }] : [];
    });

  const blocosPersonalizados = blocos
    .filter((bloco) => bloco.tipo === "personalizado")
    .slice()
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    .map((bloco) => ({
      id: id("bloco"),
      titulo: texto(bloco.titulo),
      texto: texto((bloco.conteudo as { texto?: unknown } | null)?.texto),
    }));

  const acerca = {
    titulo: texto(acercaGuardada.titulo) || DADOS_EVENTO_VAZIOS.acerca.titulo,
    introducao: texto(acercaGuardada.introducao),
    acessibilidade: texto(acercaGuardada.acessibilidade),
    estacionamento: texto(acercaGuardada.estacionamento),
    transportes: texto(acercaGuardada.transportes),
    alimentacao: texto(acercaGuardada.alimentacao),
    regras: texto(acercaGuardada.regras),
  };
  const temAcerca = Object.entries(acerca).some(([chave, valor]) => chave !== "titulo" && Boolean(valor));

  const recorrencia = edicao.padrao_recorrencia === "fins_de_semana"
    ? "fins_de_semana"
    : (festa?.tipo_recorrencia === "unica" ? "unica" : "anual");

  return {
    ...structuredClone(DADOS_EVENTO_VAZIOS),
    nome: texto(festa?.nome),
    recorrencia,
    concelhoId: texto(festa?.concelho_id),
    freguesia: texto(festa?.freguesia),
    localNome: texto(festa?.local_nome),
    morada: texto(festa?.morada),
    codigoPostal: texto(festa?.codigo_postal),
    lat: ponto?.lat ?? null,
    lng: ponto?.lng ?? null,
    dataInicio: manterDatas ? texto(edicao.data_inicio) : "",
    dataFim: manterDatas ? texto(edicao.data_fim) : "",
    diasSemana: (edicao.dias_semana ?? []).filter((dia) => dia >= 5 && dia <= 7),
    categoriaPrincipal: (texto(festa?.categoria_principal) || "") as CategoriaPrincipal | "",
    formatoEvento: texto(festa?.formato_evento),
    tags: festa?.tags_evento ?? [],
    subtitulo: texto(edicao.subtitulo),
    resumo: texto(edicao.resumo),
    descricao: texto(edicao.descricao) || texto(festa?.descricao),
    cartazUrl: texto(edicao.cartaz_url),
    fotos: edicao.fotos ?? [],
    acercaAtivo: ativo(edicao.configuracao_card, "acerca", temAcerca),
    acerca,
    programaAtivo: ativo(edicao.configuracao_card, "programa", programa.length > 0),
    programa,
    informacoesAtivas: ativo(edicao.configuracao_card, "informacoes", informacoes.length > 0),
    informacoes,
    contactosAtivos: ativo(edicao.configuracao_card, "contactos", contactos.length > 0),
    contactos,
    sublocalizacoes,
    blocosPersonalizados,
  };
}

// Campos necessários para reconstruir o formulário a partir de uma edição.
export const SELECT_EDICAO_EDITAR =
  "id,data_inicio,data_fim,padrao_recorrencia,dias_semana,subtitulo,resumo,descricao,cartaz_url,fotos,programa,acerca_de,informacoes_uteis,contactos,configuracao_card," +
  "festas!inner(nome,concelho_id,freguesia,descricao,location,categoria_principal,formato_evento,tags_evento,tipo_recorrencia,local_nome,morada,codigo_postal)," +
  "edicoes_sublocalizacoes(nome,tipo,tipo_personalizado,descricao,horario,acessivel,location,ordem)," +
  "edicoes_blocos(chave,tipo,titulo,conteudo,ordem)";
