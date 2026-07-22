import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { CATEGORIAS_PRINCIPAIS, TIPOS_SUBLOCALIZACAO, nomeCategoriaPrincipal, normalizarDadosEvento } from "@/lib/criar-evento";
import { origemValida } from "@/lib/http";
import { supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CODIGO_POSTAL = /^\d{4}-\d{3}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const TIPOS_LOCAL = new Set(TIPOS_SUBLOCALIZACAO.map((tipo) => tipo.valor));
const CATEGORIAS = new Set<string>(CATEGORIAS_PRINCIPAIS.map((categoria) => categoria.valor));

function resposta(corpo: object, status = 200) {
  return NextResponse.json(corpo, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}

function clienteServidor() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) return null;
  return createClient(url, chave, { auth: { autoRefreshToken: false, persistSession: false } });
}

function texto(valor: unknown, limite: number, quebras = false) {
  if (typeof valor !== "string") return "";
  const normalizado = valor.normalize("NFKC").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
  return (quebras ? normalizado.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n") : normalizado.replace(/\s+/g, " ")).trim().slice(0, limite);
}

function slug(textoOriginal: string) {
  return textoOriginal.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || "evento";
}

function numero(valor: unknown) {
  return typeof valor === "number" && Number.isFinite(valor) ? valor : null;
}

function dataValida(valor: string) {
  return DATA.test(valor) && !Number.isNaN(new Date(`${valor}T12:00:00Z`).getTime());
}

function diaIso(data: string) {
  return new Date(`${data}T12:00:00Z`).getUTCDay() || 7;
}

function intervaloTemDia(inicio: string, fim: string, dias: number[]) {
  const cursor = new Date(`${inicio}T12:00:00Z`);
  const limite = new Date(`${fim}T12:00:00Z`);
  for (let i = 0; i < 7 && cursor <= limite; i += 1) {
    if (dias.includes(cursor.getUTCDay() || 7)) return true;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return false;
}

function urlMediaPermitida(valor: string, userId: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base || !valor) return false;
  return valor.startsWith(`${base}/storage/v1/object/public/eventos-media/${userId}/`) && valor.length <= 1000;
}

function preparar(dadosBrutos: unknown, userId: string) {
  const dados = normalizarDadosEvento(dadosBrutos);
  const nome = texto(dados.nome, 140);
  const inicio = texto(dados.dataInicio, 10);
  const fim = texto(dados.dataFim, 10);
  const lat = numero(dados.lat);
  const lng = numero(dados.lng);
  if (nome.length < 3) throw new Error("Indica o nome do evento.");
  if (!UUID.test(dados.concelhoId)) throw new Error("Escolhe um concelho.");
  if (!dataValida(inicio) || (fim && !dataValida(fim))) throw new Error("Confirma as datas do evento.");
  if (fim && fim < inicio) throw new Error("A data de fim não pode ser anterior ao início.");
  const duracao = Math.ceil(((new Date(`${fim || inicio}T12:00:00Z`).getTime() - new Date(`${inicio}T12:00:00Z`).getTime()) / 86_400_000)) + 1;
  const finsDeSemana = dados.recorrencia === "fins_de_semana";
  const diasSemana = finsDeSemana
    ? Array.from(new Set(dados.diasSemana.filter((dia) => Number.isInteger(dia) && dia >= 5 && dia <= 7))).sort()
    : [];
  if (finsDeSemana && !fim) throw new Error("Indica até quando o evento se repete.");
  if (finsDeSemana && diasSemana.length === 0) throw new Error("Escolhe pelo menos um dia do fim de semana.");
  if (finsDeSemana && fim && !intervaloTemDia(inicio, fim, diasSemana)) throw new Error("O intervalo não contém nenhum dos dias escolhidos.");
  if (duracao > (finsDeSemana ? 366 : 62)) throw new Error(finsDeSemana ? "A repetição não pode ultrapassar um ano." : "Uma edição não pode ultrapassar 62 dias.");
  if (lat == null || lng == null || lat < 32 || lat > 43 || lng < -32 || lng > -5.5) throw new Error("Marca uma localização válida em Portugal.");
  const codigoPostal = texto(dados.codigoPostal, 8);
  if (codigoPostal && !CODIGO_POSTAL.test(codigoPostal)) throw new Error("Usa um código postal no formato 0000-000.");

  if (!CATEGORIAS.has(dados.categoriaPrincipal)) throw new Error("Escolhe a categoria principal do evento.");
  const categoriaPrincipal = dados.categoriaPrincipal;
  const formatoEvento = texto(dados.formatoEvento, 80);
  if (formatoEvento && formatoEvento.length < 2) throw new Error("O formato do evento é demasiado curto.");
  if (categoriaPrincipal === "outro" && !formatoEvento) throw new Error("Indica o formato deste evento.");
  const tags = Array.from(new Map(dados.tags.slice(0, 8).map((tag) => texto(tag, 30).replace(/[^\p{L}\p{N}\s&+'-]/gu, "").trim()).filter(Boolean).map((tag) => [tag.toLocaleLowerCase("pt"), tag])).values());
  const categoriasLegado = Array.from(new Set([formatoEvento, nomeCategoriaPrincipal(categoriaPrincipal)].filter(Boolean))).slice(0, 5);
  const cartazUrl = urlMediaPermitida(dados.cartazUrl, userId) ? dados.cartazUrl : "";
  const fotos = dados.fotos.filter((foto) => urlMediaPermitida(foto, userId)).slice(0, 20);
  const programa = dados.programaAtivo ? dados.programa.slice(0, 100).flatMap((item) => {
    const dia = texto(item.dia, 10);
    const hora = texto(item.hora, 5);
    const titulo = texto(item.titulo, 180);
    if (!dataValida(dia) || !titulo || dia < inicio || dia > (fim || inicio) || (finsDeSemana && !diasSemana.includes(diaIso(dia))) || (hora && !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora))) return [];
    return [{ dia, hora, titulo }];
  }) : [];
  if (dados.programaAtivo && programa.length !== Math.min(dados.programa.length, 100)) {
    throw new Error("Confirma as datas, horas e títulos do programa. Cada dia tem de ficar dentro das datas do evento.");
  }
  const programaAgrupado = Object.entries(Object.groupBy(programa, (item) => item.dia)).map(([dia, itens]) => ({
    dia,
    eventos: (itens ?? []).map((item) => ({ ...(item.hora ? { hora: item.hora } : {}), titulo: item.titulo })),
  })).sort((a, b) => a.dia.localeCompare(b.dia));

  const acerca = dados.acercaAtivo ? {
    titulo: texto(dados.acerca.titulo, 100),
    introducao: texto(dados.acerca.introducao, 2000, true),
    acessibilidade: texto(dados.acerca.acessibilidade, 2000, true),
    estacionamento: texto(dados.acerca.estacionamento, 2000, true),
    transportes: texto(dados.acerca.transportes, 2000, true),
    alimentacao: texto(dados.acerca.alimentacao, 2000, true),
    regras: texto(dados.acerca.regras, 2000, true),
  } : {};
  const informacoes = dados.informacoesAtivas ? dados.informacoes.slice(0, 20).flatMap((item) => {
    const titulo = texto(item.titulo, 80); const conteudo = texto(item.texto, 400, true);
    return titulo && conteudo ? [{ titulo, texto: conteudo }] : [];
  }) : [];
  const contactos = dados.contactosAtivos ? dados.contactos.slice(0, 10).flatMap((item) => {
    const valor = texto(item.valor, 300);
    if (!valor || !["telefone", "email", "site", "rede_social"].includes(item.tipo)) return [];
    if ((item.tipo === "site" || item.tipo === "rede_social") && !/^https?:\/\//i.test(valor)) return [];
    if (item.tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor)) return [];
    return [{ tipo: item.tipo, valor }];
  }) : [];
  const sublocalizacoes = dados.sublocalizacoes.slice(0, 50).flatMap((local, ordem) => {
    const nomeLocal = texto(local.nome, 120); const localLat = numero(local.lat); const localLng = numero(local.lng);
    if (!nomeLocal || !TIPOS_LOCAL.has(local.tipo) || localLat == null || localLng == null || localLat < 32 || localLat > 43 || localLng < -32 || localLng > -5.5) return [];
    return [{ nome: nomeLocal, tipo: local.tipo, tipo_personalizado: local.tipo === "outro" ? texto(local.tipoPersonalizado, 60) || null : null, descricao: texto(local.descricao, 500, true) || null, horario: texto(local.horario, 160) || null, acessivel: typeof local.acessivel === "boolean" ? local.acessivel : null, location: `POINT(${localLng} ${localLat})`, ordem, visivel: true }];
  });
  const blocos = dados.blocosPersonalizados.slice(0, 20).flatMap((bloco, indice) => {
    const titulo = texto(bloco.titulo, 100); const conteudo = texto(bloco.texto, 4000, true);
    return titulo && conteudo ? [{ chave: `personalizado_${indice + 1}`, tipo: "personalizado", titulo, conteudo: { texto: conteudo }, visivel: true, ordem: 50 + indice }] : [];
  });

  return {
    dados,
    nome,
    inicio,
    fim: fim || null,
    lat,
    lng,
    codigoPostal: codigoPostal || null,
    categoriaPrincipal,
    formatoEvento,
    tags,
    categoriasLegado,
    diasSemana,
    cartazUrl: cartazUrl || null,
    fotos,
    programaAgrupado,
    acerca,
    informacoes,
    contactos,
    sublocalizacoes,
    blocos,
  };
}

async function desfazer(admin: SupabaseClient, festaId: string | null, rascunhoId: string, versaoOriginal: number, userId: string) {
  if (festaId) await admin.from("festas").delete().eq("id", festaId).eq("criado_por", userId);
  await admin.from("eventos_rascunho").update({ versao: versaoOriginal, updated_at: new Date().toISOString() }).eq("id", rascunhoId).eq("user_id", userId).eq("versao", versaoOriginal + 1);
}

export async function POST(req: Request) {
  if (!origemValida(req)) return resposta({ error: "Pedido inválido." }, 400);
  const tamanho = Number(req.headers.get("content-length") ?? 0);
  if (!Number.isFinite(tamanho) || tamanho > 4096) return resposta({ error: "Pedido inválido." }, 400);
  let corpo: Record<string, unknown>;
  try { corpo = await req.json(); } catch { return resposta({ error: "Pedido inválido." }, 400); }
  const rascunhoId = typeof corpo.rascunhoId === "string" ? corpo.rascunhoId : "";
  const versao = Number(corpo.versao);
  if (!UUID.test(rascunhoId) || !Number.isInteger(versao) || versao < 1) return resposta({ error: "Rascunho inválido." }, 400);

  const sessao = await supabaseServer();
  const { data: { user } } = await sessao.auth.getUser();
  if (!user) return resposta({ error: "Inicia sessão para submeter o evento." }, 401);
  const { data: perfil } = await sessao.from("perfis").select("papel").eq("id", user.id).single();
  if (perfil?.papel !== "organizador" && perfil?.papel !== "admin") return resposta({ error: "A tua conta ainda não pode criar eventos." }, 403);
  const admin = clienteServidor();
  if (!admin) return resposta({ error: "A submissão de eventos não está configurada." }, 503);

  const { data: rascunho, error: erroBloqueio } = await admin.from("eventos_rascunho")
    .update({ versao: versao + 1, updated_at: new Date().toISOString() })
    .eq("id", rascunhoId).eq("user_id", user.id).eq("versao", versao)
    .select("dados,edicao_origem").maybeSingle();
  if (erroBloqueio) return resposta({ error: "Não foi possível preparar a submissão." }, 502);
  if (!rascunho) return resposta({ error: "Este evento já foi enviado ou o rascunho mudou noutra janela." }, 409);

  let validado: ReturnType<typeof preparar>;
  try { validado = preparar(rascunho.dados, user.id); }
  catch (falha) {
    await admin.from("eventos_rascunho").update({ versao, updated_at: new Date().toISOString() }).eq("id", rascunhoId).eq("user_id", user.id).eq("versao", versao + 1);
    return resposta({ error: falha instanceof Error ? falha.message : "Confirma os dados do evento." }, 400);
  }

  const { data: concelho } = await admin.from("concelhos").select("id,slug").eq("id", validado.dados.concelhoId).maybeSingle();
  if (!concelho) { await desfazer(admin, null, rascunhoId, versao, user.id); return resposta({ error: "O concelho selecionado não existe." }, 400); }

  // ── Edição de um evento existente ────────────────────────────────────────
  // O estado nunca é tocado: um evento publicado continua publicado (as
  // entidades já foram verificadas) e um pendente continua a aguardar revisão.
  if (rascunho.edicao_origem) {
    const ehAdmin = perfil?.papel === "admin";
    let consulta = admin.from("edicoes").select("id,festa_id,estado").eq("id", rascunho.edicao_origem);
    if (!ehAdmin) consulta = consulta.eq("criado_por", user.id);
    const { data: original } = await consulta.maybeSingle();
    if (!original) {
      await admin.from("eventos_rascunho").update({ versao, updated_at: new Date().toISOString() }).eq("id", rascunhoId).eq("user_id", user.id).eq("versao", versao + 1);
      return resposta({ error: "Já não podes editar este evento." }, 403);
    }

    const { data: festaAtual } = await admin.from("festas").select("slug").eq("id", original.festa_id).maybeSingle();

    const { error: erroFestaUpdate } = await admin.from("festas").update({
      nome: validado.nome,
      concelho_id: concelho.id,
      freguesia: texto(validado.dados.freguesia, 100) || null,
      descricao: texto(validado.dados.descricao, 8000, true) || null,
      location: `POINT(${validado.lng} ${validado.lat})`,
      categorias: validado.categoriasLegado,
      categoria_principal: validado.categoriaPrincipal,
      formato_evento: validado.formatoEvento || null,
      tags_evento: validado.tags,
      tipo_recorrencia: validado.dados.recorrencia,
      local_nome: texto(validado.dados.localNome, 120) || null,
      morada: texto(validado.dados.morada, 220) || null,
      codigo_postal: validado.codigoPostal,
      updated_at: new Date().toISOString(),
    }).eq("id", original.festa_id);

    const { error: erroEdicaoUpdate } = await admin.from("edicoes").update({
      ano: Number(validado.inicio.slice(0, 4)),
      data_inicio: validado.inicio,
      data_fim: validado.fim,
      padrao_recorrencia: validado.dados.recorrencia === "fins_de_semana" ? "fins_de_semana" : "continuo",
      dias_semana: validado.diasSemana,
      programa: validado.programaAgrupado.length ? validado.programaAgrupado : null,
      cartaz_url: validado.cartazUrl,
      fotos: validado.fotos,
      caracteristicas: [...validado.categoriasLegado, ...validado.tags].slice(0, 12),
      subtitulo: texto(validado.dados.subtitulo, 180) || null,
      resumo: texto(validado.dados.resumo, 320, true) || null,
      descricao: texto(validado.dados.descricao, 8000, true) || null,
      acerca_de: validado.acerca,
      informacoes_uteis: validado.informacoes,
      contactos: validado.contactos,
      links: validado.contactos.filter((item) => item.tipo === "site" || item.tipo === "rede_social"),
      configuracao_card: { acerca: validado.dados.acercaAtivo, programa: validado.dados.programaAtivo, informacoes: validado.dados.informacoesAtivas, contactos: validado.dados.contactosAtivos },
      updated_at: new Date().toISOString(),
    }).eq("id", original.id);

    if (erroFestaUpdate || erroEdicaoUpdate) {
      await admin.from("eventos_rascunho").update({ versao, updated_at: new Date().toISOString() }).eq("id", rascunhoId).eq("user_id", user.id).eq("versao", versao + 1);
      return resposta({ error: "Não foi possível guardar as alterações." }, 502);
    }

    // Substitui o conteúdo dependente pelo estado novo.
    await Promise.all([
      admin.from("edicoes_blocos").delete().eq("edicao_id", original.id),
      admin.from("edicoes_media").delete().eq("edicao_id", original.id),
      admin.from("edicoes_sublocalizacoes").delete().eq("edicao_id", original.id),
    ]);
    const blocosEdicao = [
      ...(validado.dados.acercaAtivo && Object.values(validado.acerca).some(Boolean) ? [{ edicao_id: original.id, chave: "acerca", tipo: "acerca", titulo: validado.acerca.titulo || "Acerca", conteudo: validado.acerca, visivel: true, ordem: 20 }] : []),
      ...validado.blocos.map((bloco) => ({ ...bloco, edicao_id: original.id })),
    ];
    const mediaEdicao = [
      ...(validado.cartazUrl ? [{ edicao_id: original.id, tipo: "cartaz", url: validado.cartazUrl, ordem: 0 }] : []),
      ...validado.fotos.map((url, ordem) => ({ edicao_id: original.id, tipo: "foto", url, ordem })),
    ];
    const locaisEdicao = validado.sublocalizacoes.map((local) => ({ ...local, edicao_id: original.id }));
    await Promise.all([
      blocosEdicao.length ? admin.from("edicoes_blocos").insert(blocosEdicao) : Promise.resolve({ error: null }),
      mediaEdicao.length ? admin.from("edicoes_media").insert(mediaEdicao) : Promise.resolve({ error: null }),
      locaisEdicao.length ? admin.from("edicoes_sublocalizacoes").insert(locaisEdicao) : Promise.resolve({ error: null }),
    ]);

    await admin.from("eventos_rascunho").delete().eq("id", rascunhoId).eq("user_id", user.id);
    return resposta({ ok: true, href: `/festas/${concelho.slug}/${festaAtual?.slug ?? ""}`, festaId: original.festa_id, edicaoId: original.id, atualizado: true });
  }

  let slugEvento = slug(validado.nome);
  const { data: colisao } = await admin.from("festas").select("id").eq("concelho_id", concelho.id).eq("slug", slugEvento).maybeSingle();
  if (colisao) slugEvento = `${slugEvento}-${crypto.randomUUID().slice(0, 6)}`;

  let festaId: string | null = null;
  const { data: festa, error: erroFesta } = await admin.from("festas").insert({
    slug: slugEvento,
    nome: validado.nome,
    concelho_id: concelho.id,
    freguesia: texto(validado.dados.freguesia, 100) || null,
    descricao: texto(validado.dados.descricao, 8000, true) || null,
    location: `POINT(${validado.lng} ${validado.lat})`,
    categorias: validado.categoriasLegado,
    categoria_principal: validado.categoriaPrincipal,
    formato_evento: validado.formatoEvento || null,
    tags_evento: validado.tags,
    tipo_recorrencia: validado.dados.recorrencia,
    criado_por: user.id,
    local_nome: texto(validado.dados.localNome, 120) || null,
    morada: texto(validado.dados.morada, 220) || null,
    codigo_postal: validado.codigoPostal,
    updated_at: new Date().toISOString(),
  }).select("id").single();
  if (erroFesta || !festa) { await desfazer(admin, null, rascunhoId, versao, user.id); return resposta({ error: "Não foi possível criar a ficha do evento." }, 502); }
  festaId = festa.id;

  const { data: edicao, error: erroEdicao } = await admin.from("edicoes").insert({
    festa_id: festaId,
    ano: Number(validado.inicio.slice(0, 4)),
    data_inicio: validado.inicio,
    data_fim: validado.fim,
    padrao_recorrencia: validado.dados.recorrencia === "fins_de_semana" ? "fins_de_semana" : "continuo",
    dias_semana: validado.diasSemana,
    estado: "pendente",
    programa: validado.programaAgrupado.length ? validado.programaAgrupado : null,
    cartaz_url: validado.cartazUrl,
    fotos: validado.fotos,
    caracteristicas: [...validado.categoriasLegado, ...validado.tags].slice(0, 12),
    criado_por: user.id,
    subtitulo: texto(validado.dados.subtitulo, 180) || null,
    resumo: texto(validado.dados.resumo, 320, true) || null,
    descricao: texto(validado.dados.descricao, 8000, true) || null,
    acerca_de: validado.acerca,
    informacoes_uteis: validado.informacoes,
    contactos: validado.contactos,
    links: validado.contactos.filter((item) => item.tipo === "site" || item.tipo === "rede_social"),
    configuracao_card: { acerca: validado.dados.acercaAtivo, programa: validado.dados.programaAtivo, informacoes: validado.dados.informacoesAtivas, contactos: validado.dados.contactosAtivos },
    submetida_em: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select("id").single();
  if (erroEdicao || !edicao) { await desfazer(admin, festaId, rascunhoId, versao, user.id); return resposta({ error: "Não foi possível criar a edição do evento." }, 502); }

  const blocosBase = [
    ...(validado.dados.acercaAtivo && Object.values(validado.acerca).some(Boolean) ? [{ edicao_id: edicao.id, chave: "acerca", tipo: "acerca", titulo: validado.acerca.titulo || "Acerca", conteudo: validado.acerca, visivel: true, ordem: 20 }] : []),
    ...validado.blocos.map((bloco) => ({ ...bloco, edicao_id: edicao.id })),
  ];
  const media = [
    ...(validado.cartazUrl ? [{ edicao_id: edicao.id, tipo: "cartaz", url: validado.cartazUrl, ordem: 0 }] : []),
    ...validado.fotos.map((url, ordem) => ({ edicao_id: edicao.id, tipo: "foto", url, ordem })),
  ];
  const locais = validado.sublocalizacoes.map((local) => ({ ...local, edicao_id: edicao.id }));

  const operacoes = await Promise.all([
    blocosBase.length ? admin.from("edicoes_blocos").insert(blocosBase) : Promise.resolve({ error: null }),
    media.length ? admin.from("edicoes_media").insert(media) : Promise.resolve({ error: null }),
    locais.length ? admin.from("edicoes_sublocalizacoes").insert(locais) : Promise.resolve({ error: null }),
  ]);
  if (operacoes.some((operacao) => operacao.error)) { await desfazer(admin, festaId, rascunhoId, versao, user.id); return resposta({ error: "Não foi possível guardar todo o conteúdo do evento." }, 502); }

  await admin.from("eventos_rascunho").delete().eq("id", rascunhoId).eq("user_id", user.id);
  return resposta({ ok: true, href: `/festas/${concelho.slug}/${slugEvento}`, festaId, edicaoId: edicao.id }, 201);
}
