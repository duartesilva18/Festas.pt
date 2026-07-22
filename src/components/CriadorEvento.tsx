"use client";

/* eslint-disable @next/next/no-img-element -- URLs carregados pelo utilizador não têm host conhecido antecipadamente. */

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import SeletorConcelho from "@/components/SeletorConcelho";
import {
  CATEGORIAS_PRINCIPAIS,
  DADOS_EVENTO_VAZIOS,
  FORMATOS_SUGERIDOS,
  TIPOS_SUBLOCALIZACAO,
  nomeCategoriaPrincipal,
  normalizarDadosEvento,
  novoId,
  type DadosCriarEvento,
  type RascunhoEvento,
  type SublocalizacaoRascunho,
} from "@/lib/criar-evento";

const EditorMapaEvento = dynamic(() => import("@/components/EditorMapaEvento"), {
  ssr: false,
  loading: () => <div className="h-[430px] animate-pulse rounded-xl bg-[#1A2E4F]/5" aria-label="A carregar mapa" />,
});

type Concelho = { id: string; nome: string; distrito: string };
type EstadoGravacao = "quieto" | "a_gravar" | "guardado" | "erro";

const PASSOS = [
  { nome: "Dados", descricao: "O essencial" },
  { nome: "Página", descricao: "Conteúdo opcional" },
  { nome: "Recinto", descricao: "Mapa e pontos" },
  { nome: "Rever", descricao: "Confirmar e enviar" },
];

const inputClasse = "mt-1.5 w-full rounded-lg border border-[#1A2E4F]/15 bg-white px-3 py-2.5 text-sm text-[#102745] outline-none transition placeholder:text-[#1A2E4F]/35 focus:border-[#EC2456]/55 focus:ring-2 focus:ring-[#EC2456]/10 disabled:bg-[#1A2E4F]/[0.03]";
const labelClasse = "block text-xs font-bold text-[#102745]";

function Icone({ tipo, className = "size-4" }: { tipo: "seta" | "mais" | "lixo" | "imagem" | "check" | "mapa" | "guardar" | "olho"; className?: string }) {
  const props = { className, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (tipo === "seta") return <svg {...props}><path d="m9 18 6-6-6-6" /></svg>;
  if (tipo === "mais") return <svg {...props}><path d="M12 5v14M5 12h14" /></svg>;
  if (tipo === "lixo") return <svg {...props}><path d="M4 7h16M9 7V4h6v3M8 11v6M12 11v6M16 11v6M6 7l1 14h10l1-14" /></svg>;
  if (tipo === "imagem") return <svg {...props}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="m21 15-5-5L5 20" /></svg>;
  if (tipo === "check") return <svg {...props}><path d="m5 12 4 4L19 6" /></svg>;
  if (tipo === "mapa") return <svg {...props}><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2" /></svg>;
  if (tipo === "guardar") return <svg {...props}><path d="M5 4h12l2 2v14H5zM8 4v6h8V4M8 20v-6h8v6" /></svg>;
  return <svg {...props}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" /><circle cx="12" cy="12" r="2.5" /></svg>;
}

function AjudaContextual({ titulo, texto }: { titulo: string; texto: string }) {
  const [aberta, setAberta] = useState(false);
  const recipienteRef = useRef<HTMLSpanElement>(null);
  const id = useId();

  useEffect(() => {
    if (!aberta) return;
    const fecharFora = (evento: PointerEvent) => {
      if (!recipienteRef.current?.contains(evento.target as Node)) setAberta(false);
    };
    const fecharEscape = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAberta(false);
    };
    document.addEventListener("pointerdown", fecharFora);
    document.addEventListener("keydown", fecharEscape);
    return () => {
      document.removeEventListener("pointerdown", fecharFora);
      document.removeEventListener("keydown", fecharEscape);
    };
  }, [aberta]);

  return (
    <span ref={recipienteRef} className="group relative ml-1.5 inline-flex align-middle">
      <button
        type="button"
        aria-label={`Ajuda sobre ${titulo}`}
        aria-expanded={aberta}
        aria-controls={id}
        onClick={(evento) => {
          evento.preventDefault();
          evento.stopPropagation();
          setAberta((atual) => !atual);
        }}
        className="inline-flex size-[19px] cursor-pointer items-center justify-center rounded-full border border-[#1A2E4F]/20 bg-white text-[11px] font-extrabold leading-none text-[#1A2E4F]/55 transition hover:border-[#EC2456]/35 hover:bg-[#EC2456]/[0.045] hover:text-[#EC2456] focus-visible:border-[#EC2456]/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EC2456]/15"
      >
        <span aria-hidden="true">?</span>
      </button>
      <span
        id={id}
        role="tooltip"
        className={`pointer-events-none absolute left-0 top-[calc(100%+7px)] z-50 w-56 rounded-lg border border-[#102745]/10 bg-[#102745] px-3 py-2.5 text-left text-xs font-medium normal-case leading-relaxed tracking-normal text-white shadow-lg transition duration-150 ${aberta ? "visible translate-y-0 opacity-100" : "invisible -translate-y-1 opacity-0 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"}`}
      >
        {texto}
      </span>
    </span>
  );
}

function Switch({ ativo, onChange, titulo, descricao }: { ativo: boolean; onChange: (ativo: boolean) => void; titulo: string; descricao: string }) {
  return (
    <button type="button" role="switch" aria-checked={ativo} onClick={() => onChange(!ativo)} className="flex w-full items-center justify-between gap-4 py-3 text-left">
      <span><span className="block text-sm font-bold text-[#102745]">{titulo}</span><span className="mt-0.5 block text-xs leading-relaxed text-[#1A2E4F]/55">{descricao}</span></span>
      <span className={`relative h-6 w-11 shrink-0 rounded-full transition ${ativo ? "bg-[#EC2456]" : "bg-[#1A2E4F]/15"}`}><span className={`absolute top-1 size-4 rounded-full bg-white shadow-sm transition ${ativo ? "left-6" : "left-1"}`} /></span>
    </button>
  );
}

function CabecalhoSecao({ titulo, descricao, ajuda }: { titulo: string; descricao?: string; ajuda?: string }) {
  return <div className="mb-5"><h2 className="flex items-center text-xl font-bold text-[#102745]">{titulo}{ajuda && <AjudaContextual titulo={titulo} texto={ajuda} />}</h2>{descricao && <p className="mt-1 text-sm leading-relaxed text-[#1A2E4F]/60">{descricao}</p>}</div>;
}

function BotaoRemover({ onClick, label }: { onClick: () => void; label: string }) {
  return <button type="button" onClick={onClick} aria-label={label} className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#1A2E4F]/35 transition hover:bg-[#EC2456]/8 hover:text-[#EC2456]"><Icone tipo="lixo" /></button>;
}

function formatarData(data: string) {
  if (!data) return "Data por definir";
  return new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${data}T12:00:00`));
}

const DIAS_FIM_DE_SEMANA = [
  { valor: 5, nome: "Sexta" },
  { valor: 6, nome: "Sábado" },
  { valor: 7, nome: "Domingo" },
] as const;

function resumoFinsDeSemana(inicio: string, fim: string, diasAtivos: number[]) {
  if (!inicio || !fim || fim < inicio || diasAtivos.length === 0) return "";
  const cursor = new Date(`${inicio}T12:00:00Z`);
  const limite = new Date(`${fim}T12:00:00Z`);
  const totalDias = Math.floor((limite.getTime() - cursor.getTime()) / 86_400_000) + 1;
  if (!Number.isFinite(totalDias) || totalDias > 366) return "O período máximo é de um ano.";
  const finsDeSemana = new Set<string>();
  let ocorrencias = 0;
  while (cursor <= limite) {
    const dia = cursor.getUTCDay() || 7;
    if (diasAtivos.includes(dia)) {
      ocorrencias += 1;
      const sabado = new Date(cursor);
      sabado.setUTCDate(sabado.getUTCDate() + (6 - dia));
      finsDeSemana.add(sabado.toISOString().slice(0, 10));
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  if (!ocorrencias) return "O intervalo escolhido não contém nenhum dos dias selecionados.";
  return `${finsDeSemana.size} fim${finsDeSemana.size === 1 ? "" : "s"} de semana · ${ocorrencias} ocorrência${ocorrencias === 1 ? "" : "s"}`;
}

export default function CriadorEvento({
  concelhos,
  rascunhoInicial,
  edicaoOrigem = null,
  modo = "novo",
}: {
  concelhos: Concelho[];
  rascunhoInicial: RascunhoEvento | null;
  edicaoOrigem?: string | null;
  modo?: "novo" | "editar" | "duplicar";
}) {
  const [passo, setPasso] = useState(0);
  const [novaTag, setNovaTag] = useState("");
  const [dados, setDados] = useState<DadosCriarEvento>(() => normalizarDadosEvento(rascunhoInicial?.dados ?? DADOS_EVENTO_VAZIOS));
  const [estadoGravacao, setEstadoGravacao] = useState<EstadoGravacao>(rascunhoInicial?.id ? "guardado" : "quieto");
  const [erro, setErro] = useState("");
  const [aSubmeter, setASubmeter] = useState(false);
  const [resultado, setResultado] = useState<{ href: string; nome: string } | null>(null);
  const [aCarregarImagem, setACarregarImagem] = useState<"cartaz" | "foto" | null>(null);
  const [alvoMapa, setAlvoMapa] = useState<"principal" | string>("principal");
  const idRef = useRef<string | null>(rascunhoInicial?.id || null);
  const versaoRef = useRef(rascunhoInicial?.versao ?? 0);
  const filaRef = useRef<Promise<unknown>>(Promise.resolve());
  const primeiraRenderizacao = useRef(true);
  // Ao editar/duplicar o formulário chega preenchido mas sem rascunho gravado:
  // deixamos a marca vazia para a primeira gravação acontecer.
  const serializadoGuardado = useRef(rascunhoInicial?.id ? JSON.stringify(normalizarDadosEvento(rascunhoInicial.dados)) : "");

  const concelho = useMemo(() => concelhos.find((item) => item.id === dados.concelhoId) ?? null, [concelhos, dados.concelhoId]);

  function alterar<K extends keyof DadosCriarEvento>(campo: K, valor: DadosCriarEvento[K]) {
    setDados((atual) => ({ ...atual, [campo]: valor }));
    setErro("");
  }

  function guardar(snapshot: DadosCriarEvento) {
    const serializado = JSON.stringify(snapshot);
    if (serializado === serializadoGuardado.current && idRef.current) {
      return filaRef.current.then(() => ({ id: idRef.current!, versao: versaoRef.current }));
    }
    const operacao = filaRef.current.catch(() => undefined).then(async () => {
      setEstadoGravacao("a_gravar");
      const resposta = await fetch("/api/organizador/eventos/rascunho", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: idRef.current, versao: versaoRef.current, nome: snapshot.nome.trim() || "Evento sem título", dados: snapshot, edicaoOrigem }),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.error || "Não foi possível guardar o rascunho.");
      idRef.current = corpo.rascunho.id;
      versaoRef.current = corpo.rascunho.versao;
      serializadoGuardado.current = serializado;
      setEstadoGravacao("guardado");
      return { id: corpo.rascunho.id as string, versao: corpo.rascunho.versao as number };
    }).catch((falha) => {
      setEstadoGravacao("erro");
      throw falha;
    });
    filaRef.current = operacao;
    return operacao;
  }

  useEffect(() => {
    if (primeiraRenderizacao.current) { primeiraRenderizacao.current = false; return; }
    const temporizador = window.setTimeout(() => { void guardar(dados).catch(() => undefined); }, 1000);
    return () => window.clearTimeout(temporizador);
    // O estado completo é intencional: qualquer alteração deve ativar o autosave.
  }, [dados]);

  async function carregarImagem(ficheiro: File, tipo: "cartaz" | "foto") {
    setACarregarImagem(tipo);
    setErro("");
    try {
      const formulario = new FormData();
      formulario.set("tipo", tipo);
      formulario.set("ficheiro", ficheiro);
      const resposta = await fetch("/api/organizador/eventos/media", { method: "POST", body: formulario });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.error || "Não foi possível carregar a imagem.");
      if (tipo === "cartaz") alterar("cartazUrl", corpo.url);
      else alterar("fotos", [...dados.fotos, corpo.url].slice(0, 20));
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível carregar a imagem.");
    } finally {
      setACarregarImagem(null);
    }
  }

  function errosObrigatorios() {
    const faltas: string[] = [];
    if (dados.nome.trim().length < 3) faltas.push("nome do evento");
    if (!dados.concelhoId) faltas.push("concelho");
    if (!dados.categoriaPrincipal) faltas.push("categoria do evento");
    if (dados.categoriaPrincipal === "outro" && dados.formatoEvento.trim().length < 2) faltas.push("formato do evento");
    if (!dados.dataInicio) faltas.push("data de início");
    if (dados.lat == null || dados.lng == null) faltas.push("localização principal no mapa");
    if (dados.dataFim && dados.dataInicio && dados.dataFim < dados.dataInicio) faltas.push("data de fim válida");
    if (dados.recorrencia === "fins_de_semana" && !dados.dataFim) faltas.push("data limite da repetição");
    if (dados.recorrencia === "fins_de_semana" && dados.diasSemana.length === 0) faltas.push("pelo menos um dia do fim de semana");
    if (dados.recorrencia === "fins_de_semana" && dados.dataInicio && dados.dataFim && !resumoFinsDeSemana(dados.dataInicio, dados.dataFim, dados.diasSemana).includes("ocorrência")) faltas.push("intervalo com dias selecionados");
    return faltas;
  }

  function adicionarTag() {
    const tag = novaTag.normalize("NFKC").replace(/\s+/g, " ").trim().slice(0, 30);
    if (!tag || dados.tags.some((atual) => atual.toLocaleLowerCase("pt") === tag.toLocaleLowerCase("pt")) || dados.tags.length >= 8) return;
    alterar("tags", [...dados.tags, tag]);
    setNovaTag("");
  }

  async function submeter() {
    const faltas = errosObrigatorios();
    if (faltas.length) {
      setErro(`Falta confirmar: ${faltas.join(", ")}.`);
      setPasso(faltas.includes("localização principal no mapa") ? 2 : 0);
      return;
    }
    setASubmeter(true);
    setErro("");
    try {
      const meta = await guardar(dados) as { id: string; versao: number };
      const resposta = await fetch("/api/organizador/eventos/submeter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rascunhoId: meta.id, versao: meta.versao }),
      });
      const corpo = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(corpo.error || "Não foi possível submeter o evento.");
      setResultado({ href: corpo.href, nome: dados.nome.trim() });
      setEstadoGravacao("quieto");
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : "Não foi possível submeter o evento.");
    } finally {
      setASubmeter(false);
    }
  }

  function adicionarSublocalizacao() {
    const local: SublocalizacaoRascunho = { id: novoId("local"), nome: "", tipo: "estacionamento", tipoPersonalizado: "", descricao: "", horario: "", acessivel: null, lat: dados.lat, lng: dados.lng };
    alterar("sublocalizacoes", [...dados.sublocalizacoes, local]);
    setAlvoMapa(local.id);
  }

  function atualizarSublocalizacao(id: string, alteracoes: Partial<SublocalizacaoRascunho>) {
    alterar("sublocalizacoes", dados.sublocalizacoes.map((local) => local.id === id ? { ...local, ...alteracoes } : local));
  }

  if (resultado) {
    return (
      <main className="mx-auto flex min-h-[calc(100dvh-66px)] max-w-2xl items-center px-5 py-12">
        <section className="w-full rounded-xl border border-[#1A2E4F]/10 bg-white p-7 text-center shadow-sm sm:p-10">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#20856D]/10 text-[#20856D]"><Icone tipo="check" className="size-6" /></span>
          <h1 className="mt-5 text-2xl font-bold text-[#102745]">Evento enviado para revisão</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#1A2E4F]/60">Guardámos “{resultado.nome}”. Podes acompanhar o estado da submissão no teu perfil.</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/perfil" className="rounded-lg bg-[#EC2456] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#d11a47]">Ver o meu perfil</Link><Link href="/" className="rounded-lg border border-[#1A2E4F]/15 px-5 py-2.5 text-sm font-bold text-[#102745] transition hover:border-[#EC2456]/30 hover:text-[#EC2456]">Voltar ao mapa</Link></div>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-[1240px] px-4 pb-24 pt-6 sm:px-6 sm:pt-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#1A2E4F]/10 pb-5">
        <div><Link href="/perfil" className="text-xs font-bold text-[#1A2E4F]/50 transition hover:text-[#EC2456]">← Voltar ao perfil</Link><h1 className="mt-2 text-2xl font-bold text-[#102745] sm:text-3xl">Criar evento</h1><p className="mt-1 text-sm text-[#1A2E4F]/55">Começa pelo essencial. Podes guardar e continuar mais tarde.</p></div>
        <div className="flex items-center gap-2 text-xs font-semibold text-[#1A2E4F]/50" aria-live="polite">
          {estadoGravacao === "a_gravar" && <><span className="size-2 animate-pulse rounded-full bg-[#F97B16]" />A guardar…</>}
          {estadoGravacao === "guardado" && <><Icone tipo="check" className="size-3.5 text-[#20856D]" />Rascunho guardado</>}
          {estadoGravacao === "erro" && <span className="text-[#EC2456]">Erro ao guardar</span>}
        </div>
      </div>

      <nav aria-label="Passos para criar evento" className="mt-5 grid grid-cols-4 overflow-hidden rounded-xl border border-[#1A2E4F]/10 bg-white">
        {PASSOS.map((item, indice) => <button key={item.nome} type="button" onClick={() => setPasso(indice)} aria-current={passo === indice ? "step" : undefined} className={`min-w-0 border-r border-[#1A2E4F]/8 px-2 py-3 text-left last:border-r-0 sm:px-4 ${passo === indice ? "bg-[#EC2456]/[0.045]" : "hover:bg-[#1A2E4F]/[0.025]"}`}><span className={`block text-[11px] font-bold sm:text-sm ${passo === indice ? "text-[#EC2456]" : "text-[#102745]"}`}>{indice + 1}. {item.nome}</span><span className="mt-0.5 hidden text-[11px] text-[#1A2E4F]/45 sm:block">{item.descricao}</span></button>)}
      </nav>

      <div className="mt-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 rounded-xl border border-[#1A2E4F]/10 bg-white p-5 shadow-sm sm:p-7">
          {passo === 0 && <div>
            <CabecalhoSecao titulo="Dados principais" descricao="São os únicos dados necessários para começares. O resto pode ser acrescentado depois." />
            <div className="space-y-5">
              <label className={labelClasse}>Nome do evento <span className="text-[#EC2456]">*</span><input maxLength={140} value={dados.nome} onChange={(e) => alterar("nome", e.target.value)} placeholder="Ex.: Feiras Novas" className={inputClasse} /></label>
              <fieldset>
                <legend className={labelClasse}><span className="inline-flex items-center">Este evento acontece<AjudaContextual titulo="recorrência do evento" texto="Escolhe fins de semana para eventos que abrem semanalmente durante um período. O mapa apresenta um único evento e deixa claro em que dias se realiza." /></span></legend>
                <div className="mt-2 grid gap-2 sm:grid-cols-3">
                  {([['anual','Todos os anos','Uma nova edição anual.'],['unica','Apenas uma vez','Sem repetição prevista.'],['fins_de_semana','Aos fins de semana','Repete semanalmente até uma data.']] as const).map(([valor,titulo,descricao]) => <label key={valor} className={`flex cursor-pointer gap-3 rounded-lg border p-3 transition ${dados.recorrencia === valor ? "border-[#EC2456]/45 bg-[#EC2456]/[0.035]" : "border-[#1A2E4F]/12 hover:border-[#1A2E4F]/25"}`}><input type="radio" name="recorrencia" value={valor} checked={dados.recorrencia === valor} onChange={() => alterar("recorrencia", valor)} className="mt-0.5 accent-[#EC2456]" /><span><strong className="block text-sm text-[#102745]">{titulo}</strong><span className="mt-0.5 block text-xs leading-relaxed text-[#1A2E4F]/55">{descricao}</span></span></label>)}
                </div>
              </fieldset>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelClasse}>{dados.recorrencia === "fins_de_semana" ? "Começa a partir de" : "Começa em"} <span className="text-[#EC2456]">*</span><input type="date" value={dados.dataInicio} onChange={(e) => alterar("dataInicio", e.target.value)} className={inputClasse} /></label>
                <label className={labelClasse}>{dados.recorrencia === "fins_de_semana" ? "Repetir até" : "Termina em"} {dados.recorrencia === "fins_de_semana" ? <span className="text-[#EC2456]">*</span> : <span className="font-normal text-[#1A2E4F]/40">(opcional)</span>}<input type="date" min={dados.dataInicio || undefined} value={dados.dataFim} onChange={(e) => alterar("dataFim", e.target.value)} className={inputClasse} /></label>
              </div>
              {dados.recorrencia === "fins_de_semana" && <div className="rounded-lg border border-[#1A2E4F]/10 bg-[#1A2E4F]/[0.025] p-4">
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-bold text-[#102745]">Em que dias?</p><p className="text-[11px] text-[#1A2E4F]/45">Podes escolher um ou vários</p></div>
                <div className="mt-3 flex flex-wrap gap-2">{DIAS_FIM_DE_SEMANA.map((dia) => { const ativo = dados.diasSemana.includes(dia.valor); return <button key={dia.valor} type="button" aria-pressed={ativo} onClick={() => alterar("diasSemana", ativo ? dados.diasSemana.filter((valor) => valor !== dia.valor) : [...dados.diasSemana, dia.valor].sort())} className={`cursor-pointer rounded-md border px-3 py-2 text-xs font-bold transition ${ativo ? "border-[#EC2456]/35 bg-[#EC2456]/8 text-[#EC2456]" : "border-[#1A2E4F]/12 bg-white text-[#1A2E4F]/55 hover:border-[#1A2E4F]/25"}`}>{dia.nome}</button>; })}</div>
                {dados.dataInicio && dados.dataFim && <p className={`mt-3 text-xs font-semibold ${resumoFinsDeSemana(dados.dataInicio, dados.dataFim, dados.diasSemana).includes("ocorrência") ? "text-[#20856D]" : "text-[#EC2456]"}`}>{resumoFinsDeSemana(dados.dataInicio, dados.dataFim, dados.diasSemana)}</p>}
              </div>}
              <div className="grid gap-4 sm:grid-cols-2"><label className={labelClasse}>Concelho <span className="text-[#EC2456]">*</span><SeletorConcelho concelhos={concelhos} valor={dados.concelhoId} onAlterar={(id) => alterar("concelhoId", id)} /></label><label className={labelClasse}>Freguesia ou localidade<input maxLength={100} value={dados.freguesia} onChange={(e) => alterar("freguesia", e.target.value)} placeholder="Ex.: Ponte de Lima" className={inputClasse} /></label></div>
              <div className="border-t border-[#1A2E4F]/8 pt-5"><h3 className="text-sm font-bold text-[#102745]">Tipo de evento</h3><p className="mt-1 text-xs leading-relaxed text-[#1A2E4F]/50">A categoria ajuda nos filtros. O formato diz exatamente o que é — por exemplo, Sunset.</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className={labelClasse}><span className="inline-flex items-center">Categoria principal <span className="ml-1 text-[#EC2456]">*</span><AjudaContextual titulo="categoria principal" texto="Escolhe a categoria que melhor representa o evento. É esta opção que será usada nos filtros e sugestões do mapa." /></span><select value={dados.categoriaPrincipal} onChange={(e) => alterar("categoriaPrincipal", e.target.value as DadosCriarEvento["categoriaPrincipal"])} className={inputClasse}><option value="">Escolher categoria</option>{CATEGORIAS_PRINCIPAIS.map((categoria) => <option key={categoria.valor} value={categoria.valor}>{categoria.nome}</option>)}</select>{dados.categoriaPrincipal && <span className="mt-1.5 block text-[11px] font-normal leading-relaxed text-[#1A2E4F]/45">{CATEGORIAS_PRINCIPAIS.find((categoria) => categoria.valor === dados.categoriaPrincipal)?.descricao}</span>}</label><label className={labelClasse}><span className="inline-flex items-center">Formato <span className="ml-1 font-normal text-[#1A2E4F]/40">(opcional)</span><AjudaContextual titulo="formato do evento" texto="Usa um nome mais específico do que a categoria, como Sunset, Romaria, Arraial, Festival gastronómico ou After." /></span><input list="formatos-evento" maxLength={80} value={dados.formatoEvento} onChange={(e) => alterar("formatoEvento", e.target.value)} placeholder="Ex.: Sunset, Romaria ou Festival" className={inputClasse} /><datalist id="formatos-evento">{FORMATOS_SUGERIDOS.map((formato) => <option key={formato} value={formato} />)}</datalist></label></div><div className="mt-4"><label className={labelClasse}><span className="inline-flex items-center">Tags <span className="ml-1 font-normal text-[#1A2E4F]/40">(opcional, até 8)</span><AjudaContextual titulo="tags" texto="Acrescenta palavras curtas que ajudem alguém a encontrar a festa, como open air, família, música popular ou entrada livre. Não repitas a categoria." /></span></label><div className="mt-1.5 flex gap-2"><input maxLength={30} value={novaTag} onChange={(e) => setNovaTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); adicionarTag(); } }} placeholder="Ex.: open air" className={`${inputClasse} mt-0`} /><button type="button" disabled={!novaTag.trim() || dados.tags.length >= 8} onClick={adicionarTag} className="rounded-lg border border-[#1A2E4F]/15 px-3 text-xs font-bold text-[#102745] transition hover:border-[#EC2456]/30 hover:text-[#EC2456] disabled:cursor-not-allowed disabled:opacity-40">Adicionar</button></div>{dados.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{dados.tags.map((tag) => <button key={tag} type="button" onClick={() => alterar("tags", dados.tags.filter((atual) => atual !== tag))} title="Remover tag" className="rounded-full bg-[#1A2E4F]/5 px-2.5 py-1 text-[11px] font-semibold text-[#1A2E4F]/65 transition hover:bg-[#EC2456]/8 hover:text-[#EC2456]">{tag} ×</button>)}</div>}</div></div>
              <div className="border-t border-[#1A2E4F]/8 pt-5"><h3 className="text-sm font-bold text-[#102745]">Morada</h3><p className="mt-1 text-xs text-[#1A2E4F]/50">Ajuda as pessoas a reconhecer o local. O ponto exato é definido no passo Recinto.</p><div className="mt-3 grid gap-4 sm:grid-cols-2"><label className={labelClasse}>Nome do local<input maxLength={120} value={dados.localNome} onChange={(e) => alterar("localNome", e.target.value)} placeholder="Praça, igreja ou recinto" className={inputClasse} /></label><label className={labelClasse}>Código postal<input inputMode="numeric" maxLength={8} value={dados.codigoPostal} onChange={(e) => alterar("codigoPostal", e.target.value)} placeholder="0000-000" className={inputClasse} /></label></div><label className={`${labelClasse} mt-4`}>Morada<input maxLength={220} value={dados.morada} onChange={(e) => alterar("morada", e.target.value)} placeholder="Rua e número, se aplicável" className={inputClasse} /></label></div>
            </div>
          </div>}

          {passo === 1 && <div>
            <CabecalhoSecao titulo="Construir a página" descricao="Ativa apenas o que fizer sentido. As secções vazias nunca aparecem ao público." />
            <div className="space-y-6">
              <div><h3 className="text-sm font-bold text-[#102745]">Apresentação</h3><div className="mt-3 grid gap-4"><label className={labelClasse}>Subtítulo<input maxLength={180} value={dados.subtitulo} onChange={(e) => alterar("subtitulo", e.target.value)} placeholder="Uma frase curta por baixo do nome" className={inputClasse} /></label><label className={labelClasse}><span className="inline-flex items-center">Resumo<AjudaContextual titulo="resumo" texto="Uma apresentação rápida da festa. Aparece antes do conteúdo detalhado e deve explicar o essencial em duas ou três frases." /></span><textarea maxLength={320} rows={3} value={dados.resumo} onChange={(e) => alterar("resumo", e.target.value)} placeholder="O que torna esta festa especial?" className={inputClasse} /></label><label className={labelClasse}><span className="inline-flex items-center">Sobre a edição<AjudaContextual titulo="descrição da edição" texto="Descreve esta edição concreta: ambiente, atrações, novidades e o que o visitante pode esperar. A história permanente da festa deve ficar em Acerca de." /></span><textarea maxLength={8000} rows={5} value={dados.descricao} onChange={(e) => alterar("descricao", e.target.value)} placeholder="Descrição principal da festa" className={inputClasse} /></label></div></div>
              <div className="border-t border-[#1A2E4F]/8 pt-3"><Switch ativo={dados.acercaAtivo} onChange={(valor) => alterar("acercaAtivo", valor)} titulo="Acerca de" descricao="História, acessibilidade, transportes, alimentação e regras." />{dados.acercaAtivo && <div className="mt-2 grid gap-4 rounded-lg bg-[#1A2E4F]/[0.025] p-4"><label className={labelClasse}>Título da secção<input maxLength={100} value={dados.acerca.titulo} onChange={(e) => alterar("acerca", { ...dados.acerca, titulo: e.target.value })} className={inputClasse} /></label>{([['introducao','Introdução'],['acessibilidade','Acessibilidade'],['estacionamento','Estacionamento'],['transportes','Transportes'],['alimentacao','Comida e bebida'],['regras','Regras e recomendações']] as const).map(([campo,nome]) => <label key={campo} className={labelClasse}>{nome}<textarea maxLength={2000} rows={3} value={dados.acerca[campo]} onChange={(e) => alterar("acerca", { ...dados.acerca, [campo]: e.target.value })} className={inputClasse} /></label>)}</div>}</div>
              <div className="border-t border-[#1A2E4F]/8 pt-3"><Switch ativo={dados.programaAtivo} onChange={(valor) => alterar("programaAtivo", valor)} titulo="Programa" descricao="Adiciona apenas os momentos que já estão confirmados." />{dados.programaAtivo && <div className="mt-2 space-y-2">{dados.programa.map((item) => <div key={item.id} className="grid gap-2 rounded-lg border border-[#1A2E4F]/10 p-3 sm:grid-cols-[130px_90px_1fr_auto]"><input aria-label="Dia" type="date" value={item.dia} onChange={(e) => alterar("programa", dados.programa.map((linha) => linha.id === item.id ? { ...linha, dia: e.target.value } : linha))} className={`${inputClasse} mt-0`} /><input aria-label="Hora" type="time" value={item.hora} onChange={(e) => alterar("programa", dados.programa.map((linha) => linha.id === item.id ? { ...linha, hora: e.target.value } : linha))} className={`${inputClasse} mt-0`} /><input aria-label="Momento" maxLength={180} value={item.titulo} onChange={(e) => alterar("programa", dados.programa.map((linha) => linha.id === item.id ? { ...linha, titulo: e.target.value } : linha))} placeholder="Ex.: Concerto no palco principal" className={`${inputClasse} mt-0`} /><BotaoRemover label="Remover momento" onClick={() => alterar("programa", dados.programa.filter((linha) => linha.id !== item.id))} /></div>)}<button type="button" onClick={() => alterar("programa", [...dados.programa, { id: novoId("programa"), dia: dados.dataInicio, hora: "", titulo: "" }])} className="inline-flex items-center gap-1.5 py-2 text-xs font-bold text-[#EC2456]"><Icone tipo="mais" />Adicionar momento</button></div>}</div>
              <div className="border-t border-[#1A2E4F]/8 pt-3"><Switch ativo={dados.informacoesAtivas} onChange={(valor) => alterar("informacoesAtivas", valor)} titulo="Informações úteis" descricao="Entradas, preços, horários ou avisos importantes." />{dados.informacoesAtivas && <div className="mt-2 space-y-2">{dados.informacoes.map((item) => <div key={item.id} className="grid gap-2 rounded-lg border border-[#1A2E4F]/10 p-3 sm:grid-cols-[180px_1fr_auto]"><input aria-label="Título" maxLength={80} value={item.titulo} onChange={(e) => alterar("informacoes", dados.informacoes.map((linha) => linha.id === item.id ? { ...linha, titulo: e.target.value } : linha))} placeholder="Ex.: Entrada" className={`${inputClasse} mt-0`} /><input aria-label="Informação" maxLength={400} value={item.texto} onChange={(e) => alterar("informacoes", dados.informacoes.map((linha) => linha.id === item.id ? { ...linha, texto: e.target.value } : linha))} placeholder="Ex.: Gratuita" className={`${inputClasse} mt-0`} /><BotaoRemover label="Remover informação" onClick={() => alterar("informacoes", dados.informacoes.filter((linha) => linha.id !== item.id))} /></div>)}<button type="button" onClick={() => alterar("informacoes", [...dados.informacoes, { id: novoId("info"), titulo: "", texto: "" }])} className="inline-flex items-center gap-1.5 py-2 text-xs font-bold text-[#EC2456]"><Icone tipo="mais" />Adicionar informação</button></div>}</div>
              <div className="border-t border-[#1A2E4F]/8 pt-3"><Switch ativo={dados.contactosAtivos} onChange={(valor) => alterar("contactosAtivos", valor)} titulo="Contactos e ligações" descricao="Telefone, email, site oficial ou rede social." />{dados.contactosAtivos && <div className="mt-2 space-y-2">{dados.contactos.map((item) => <div key={item.id} className="grid gap-2 rounded-lg border border-[#1A2E4F]/10 p-3 sm:grid-cols-[150px_1fr_auto]"><select aria-label="Tipo de contacto" value={item.tipo} onChange={(e) => alterar("contactos", dados.contactos.map((linha) => linha.id === item.id ? { ...linha, tipo: e.target.value as typeof item.tipo } : linha))} className={`${inputClasse} mt-0`}><option value="telefone">Telefone</option><option value="email">Email</option><option value="site">Site</option><option value="rede_social">Rede social</option></select><input aria-label="Contacto" maxLength={300} value={item.valor} onChange={(e) => alterar("contactos", dados.contactos.map((linha) => linha.id === item.id ? { ...linha, valor: e.target.value } : linha))} placeholder="Contacto ou endereço" className={`${inputClasse} mt-0`} /><BotaoRemover label="Remover contacto" onClick={() => alterar("contactos", dados.contactos.filter((linha) => linha.id !== item.id))} /></div>)}<button type="button" onClick={() => alterar("contactos", [...dados.contactos, { id: novoId("contacto"), tipo: "telefone", valor: "" }])} className="inline-flex items-center gap-1.5 py-2 text-xs font-bold text-[#EC2456]"><Icone tipo="mais" />Adicionar contacto</button></div>}</div>
              <div className="border-t border-[#1A2E4F]/8 pt-5"><h3 className="inline-flex items-center text-sm font-bold text-[#102745]">Imagens<AjudaContextual titulo="imagens" texto="A imagem principal funciona como capa nos cartões e no topo da página. As restantes aparecem na galeria. Usa fotografias nítidas e evita cartazes com texto demasiado pequeno." /></h3><p className="mt-1 text-xs text-[#1A2E4F]/50">JPG, PNG ou WebP até 8 MB.</p><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#1A2E4F]/20 text-sm font-bold text-[#1A2E4F]/60 transition hover:border-[#EC2456]/40 hover:text-[#EC2456]"><Icone tipo="imagem" />{aCarregarImagem === "cartaz" ? "A carregar…" : dados.cartazUrl ? "Trocar imagem principal" : "Imagem principal"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={aCarregarImagem != null} onChange={(e) => { const ficheiro = e.target.files?.[0]; if (ficheiro) void carregarImagem(ficheiro, "cartaz"); e.currentTarget.value = ""; }} /></label><label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[#1A2E4F]/20 text-sm font-bold text-[#1A2E4F]/60 transition hover:border-[#EC2456]/40 hover:text-[#EC2456]"><Icone tipo="mais" />{aCarregarImagem === "foto" ? "A carregar…" : "Adicionar fotografia"}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={aCarregarImagem != null || dados.fotos.length >= 20} onChange={(e) => { const ficheiro = e.target.files?.[0]; if (ficheiro) void carregarImagem(ficheiro, "foto"); e.currentTarget.value = ""; }} /></label></div>{dados.fotos.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">{dados.fotos.map((foto, indice) => <div key={foto} className="group relative aspect-square overflow-hidden rounded-lg bg-[#1A2E4F]/5"><img src={foto} alt="" className="size-full object-cover" /><button type="button" onClick={() => alterar("fotos", dados.fotos.filter((_, i) => i !== indice))} aria-label="Remover fotografia" className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-white/95 text-[#EC2456] opacity-100 shadow sm:opacity-0 sm:group-hover:opacity-100"><Icone tipo="lixo" className="size-3.5" /></button></div>)}</div>}</div>
              <div className="border-t border-[#1A2E4F]/8 pt-5"><div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-bold text-[#102745]">Outras secções</h3><p className="mt-1 text-xs text-[#1A2E4F]/50">Cria uma secção livre quando nenhuma das anteriores servir.</p></div><button type="button" onClick={() => alterar("blocosPersonalizados", [...dados.blocosPersonalizados, { id: novoId("bloco"), titulo: "", texto: "" }])} className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-[#EC2456]"><Icone tipo="mais" />Adicionar</button></div><div className="mt-3 space-y-3">{dados.blocosPersonalizados.map((bloco) => <div key={bloco.id} className="rounded-lg border border-[#1A2E4F]/10 p-3"><div className="flex gap-2"><input aria-label="Título da secção" maxLength={100} value={bloco.titulo} onChange={(e) => alterar("blocosPersonalizados", dados.blocosPersonalizados.map((item) => item.id === bloco.id ? { ...item, titulo: e.target.value } : item))} placeholder="Título da secção" className={`${inputClasse} mt-0`} /><BotaoRemover label="Remover secção" onClick={() => alterar("blocosPersonalizados", dados.blocosPersonalizados.filter((item) => item.id !== bloco.id))} /></div><textarea aria-label="Conteúdo da secção" maxLength={4000} rows={4} value={bloco.texto} onChange={(e) => alterar("blocosPersonalizados", dados.blocosPersonalizados.map((item) => item.id === bloco.id ? { ...item, texto: e.target.value } : item))} placeholder="Conteúdo" className={inputClasse} /></div>)}</div></div>
            </div>
          </div>}

          {passo === 2 && <div>
            <CabecalhoSecao titulo="Mapa do recinto" descricao="Primeiro marca a festa. Depois podes adicionar estacionamento, entradas, casas de banho, palcos e outros pontos." ajuda="O local principal coloca a festa no mapa público. Os outros pontos são opcionais e só devem ser adicionados quando tiveres coordenadas úteis e confirmadas para os visitantes." />
            <div className="mb-3 flex flex-wrap gap-2"><button type="button" onClick={() => setAlvoMapa("principal")} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition ${alvoMapa === "principal" ? "border-[#EC2456]/35 bg-[#EC2456]/8 text-[#EC2456]" : "border-[#1A2E4F]/12 text-[#1A2E4F]/60"}`}><Icone tipo="mapa" />Local principal</button>{dados.sublocalizacoes.map((local, indice) => <button key={local.id} type="button" onClick={() => setAlvoMapa(local.id)} className={`max-w-44 truncate rounded-lg border px-3 py-2 text-xs font-bold transition ${alvoMapa === local.id ? "border-[#EC2456]/35 bg-[#EC2456]/8 text-[#EC2456]" : "border-[#1A2E4F]/12 text-[#1A2E4F]/60"}`}>{local.nome.trim() || `Ponto ${indice + 1}`}</button>)}</div>
            <EditorMapaEvento principal={{ lat: dados.lat, lng: dados.lng }} sublocalizacoes={dados.sublocalizacoes} alvo={alvoMapa} onEscolher={(lat, lng) => { if (alvoMapa === "principal") setDados((atual) => ({ ...atual, lat, lng })); else atualizarSublocalizacao(alvoMapa, { lat, lng }); }} />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-[#1A2E4F]/50">{dados.lat != null && dados.lng != null ? `Local principal: ${dados.lat.toFixed(5)}, ${dados.lng.toFixed(5)}` : "Ainda falta marcar o local principal."}</p><button type="button" onClick={adicionarSublocalizacao} className="inline-flex items-center gap-1.5 rounded-lg bg-[#EC2456] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#d11a47]"><Icone tipo="mais" />Adicionar ponto</button></div>
            <div className="mt-5 space-y-3">{dados.sublocalizacoes.map((local, indice) => <div key={local.id} className={`rounded-xl border p-4 transition ${alvoMapa === local.id ? "border-[#EC2456]/35" : "border-[#1A2E4F]/10"}`}><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wide text-[#1A2E4F]/40">Ponto {indice + 1}</p><p className="mt-1 text-sm font-bold text-[#102745]">{local.nome.trim() || "Por preencher"}</p></div><BotaoRemover label="Remover ponto" onClick={() => { alterar("sublocalizacoes", dados.sublocalizacoes.filter((item) => item.id !== local.id)); if (alvoMapa === local.id) setAlvoMapa("principal"); }} /></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className={labelClasse}>Tipo<select value={local.tipo} onChange={(e) => atualizarSublocalizacao(local.id, { tipo: e.target.value as SublocalizacaoRascunho["tipo"] })} className={inputClasse}>{TIPOS_SUBLOCALIZACAO.map((tipo) => <option key={tipo.valor} value={tipo.valor}>{tipo.nome}</option>)}</select></label><label className={labelClasse}>Nome<input maxLength={120} value={local.nome} onChange={(e) => atualizarSublocalizacao(local.id, { nome: e.target.value })} placeholder="Ex.: Parque junto ao rio" className={inputClasse} /></label>{local.tipo === "outro" && <label className={labelClasse}>Tipo personalizado<input maxLength={60} value={local.tipoPersonalizado} onChange={(e) => atualizarSublocalizacao(local.id, { tipoPersonalizado: e.target.value })} className={inputClasse} /></label>}<label className={labelClasse}>Horário<input maxLength={160} value={local.horario} onChange={(e) => atualizarSublocalizacao(local.id, { horario: e.target.value })} placeholder="Ex.: 18:00–03:00" className={inputClasse} /></label><label className={`${labelClasse} sm:col-span-2`}>Nota útil<input maxLength={500} value={local.descricao} onChange={(e) => atualizarSublocalizacao(local.id, { descricao: e.target.value })} placeholder="Acesso, lotação ou referência" className={inputClasse} /></label></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2"><button type="button" onClick={() => setAlvoMapa(local.id)} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#EC2456]"><Icone tipo="mapa" />{local.lat == null ? "Marcar no mapa" : "Alterar posição"}</button><label className="inline-flex items-center gap-2 text-xs font-semibold text-[#1A2E4F]/60"><input type="checkbox" checked={local.acessivel === true} onChange={(e) => atualizarSublocalizacao(local.id, { acessivel: e.target.checked ? true : null })} className="accent-[#EC2456]" />Acesso condicionado preparado</label></div></div>)}</div>
          </div>}

          {passo === 3 && <div>
            <CabecalhoSecao titulo="Rever antes de enviar" descricao="Só bloqueamos o que é indispensável. Podes voltar a qualquer passo para corrigir." />
            <dl className="divide-y divide-[#1A2E4F]/8 rounded-xl border border-[#1A2E4F]/10">{[
              ["Evento", dados.nome.trim() || "Em falta"],
              ["Tipo", dados.categoriaPrincipal ? `${nomeCategoriaPrincipal(dados.categoriaPrincipal)}${dados.formatoEvento.trim() ? ` · ${dados.formatoEvento.trim()}` : ""}` : "Em falta"],
              ["Edição", dados.recorrencia === "anual" ? "Evento anual" : dados.recorrencia === "fins_de_semana" ? "Evento semanal aos fins de semana" : "Evento de edição única"],
              ["Datas", dados.dataInicio ? dados.recorrencia === "fins_de_semana" ? `${DIAS_FIM_DE_SEMANA.filter((dia) => dados.diasSemana.includes(dia.valor)).map((dia) => dia.nome).join(", ")} · até ${dados.dataFim ? formatarData(dados.dataFim) : "definir data limite"}` : `${formatarData(dados.dataInicio)}${dados.dataFim ? ` a ${formatarData(dados.dataFim)}` : ""}` : "Em falta"],
              ["Local", concelho ? `${dados.freguesia ? `${dados.freguesia}, ` : ""}${concelho.nome}` : "Em falta"],
              ["Ponto principal", dados.lat != null && dados.lng != null ? "Confirmado no mapa" : "Em falta"],
              ["Conteúdo", `${[dados.descricao, dados.acercaAtivo, dados.programaAtivo, dados.informacoesAtivas, dados.contactosAtivos].filter(Boolean).length} secções preenchidas`],
              ["Recinto", `${dados.sublocalizacoes.filter((local) => local.nome.trim() && local.lat != null && local.lng != null).length} pontos adicionais`],
            ].map(([termo, valor]) => <div key={termo} className="grid gap-1 px-4 py-3 sm:grid-cols-[150px_1fr]"><dt className="text-xs font-bold text-[#1A2E4F]/45">{termo}</dt><dd className={`text-sm font-semibold ${valor === "Em falta" ? "text-[#EC2456]" : "text-[#102745]"}`}>{valor}</dd></div>)}</dl>
            <div className="mt-5 rounded-lg bg-[#1A2E4F]/[0.035] p-4"><p className="text-sm font-bold text-[#102745]">O que acontece depois?</p><p className="mt-1 text-xs leading-relaxed text-[#1A2E4F]/60">{modo === "editar" ? "As alterações ficam visíveis no evento assim que guardares. Se o evento ainda estiver em revisão, continua a aguardar aprovação." : "A equipa revê os dados antes de colocar o evento no mapa. Enquanto estiver pendente, podes acompanhar o estado no perfil."}</p></div>
            {errosObrigatorios().length > 0 && <p className="mt-4 text-sm font-semibold text-[#EC2456]">Falta confirmar: {errosObrigatorios().join(", ")}.</p>}
            <button type="button" disabled={aSubmeter} onClick={() => void submeter()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-[#EC2456] px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-[#d11a47] disabled:cursor-not-allowed disabled:opacity-60">{aSubmeter ? (modo === "editar" ? "A guardar…" : "A enviar…") : (modo === "editar" ? "Guardar alterações" : "Enviar para revisão")}<Icone tipo="seta" /></button>
          </div>}

          {erro && <div role="alert" className="mt-5 rounded-lg border border-[#EC2456]/20 bg-[#EC2456]/[0.04] px-4 py-3 text-sm font-semibold text-[#C91D49]">{erro}</div>}
          <div className="mt-7 flex items-center justify-between border-t border-[#1A2E4F]/8 pt-5"><button type="button" disabled={passo === 0} onClick={() => setPasso((atual) => Math.max(0, atual - 1))} className="rounded-lg px-3 py-2 text-sm font-bold text-[#1A2E4F]/55 transition hover:bg-[#1A2E4F]/5 disabled:cursor-not-allowed disabled:opacity-30">Anterior</button>{passo < PASSOS.length - 1 && <button type="button" onClick={() => setPasso((atual) => Math.min(PASSOS.length - 1, atual + 1))} className="inline-flex items-center gap-1.5 rounded-lg bg-[#102745] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[#1A2E4F]">Continuar<Icone tipo="seta" /></button>}</div>
        </section>

        <aside className={`h-fit overflow-hidden rounded-xl border border-[#1A2E4F]/10 bg-white shadow-sm lg:sticky lg:top-5 ${passo !== 3 ? "hidden lg:block" : "block"}`}>
          <div className="flex items-center justify-between border-b border-[#1A2E4F]/8 px-4 py-3"><p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-[#1A2E4F]/45"><Icone tipo="olho" />Pré-visualização</p><span className="text-[10px] text-[#1A2E4F]/35">Atualiza automaticamente</span></div>
          <div className="relative h-44 bg-[#102745]">{dados.cartazUrl ? <img src={dados.cartazUrl} alt="" className="size-full object-cover opacity-85" /> : <div className="flex size-full items-center justify-center bg-[#1A2E4F]/5 text-[#1A2E4F]/25"><Icone tipo="imagem" className="size-8" /></div>}<div className="absolute inset-0 bg-gradient-to-t from-[#102745]/90 via-transparent to-transparent" /><div className="absolute bottom-0 left-0 right-0 p-4"><h2 className="line-clamp-2 text-xl font-bold leading-tight text-white">{dados.nome.trim() || "Nome da festa"}</h2><p className="mt-1 truncate text-xs text-white/75">{dados.freguesia || concelho?.nome || "Localização por definir"}{concelho && dados.freguesia ? ` · ${concelho.nome}` : ""}</p></div></div>
          <div className="p-4"><div className="flex flex-wrap gap-x-2 gap-y-1 text-xs font-semibold text-[#1A2E4F]/65"><span>{dados.recorrencia === "fins_de_semana" && dados.dataFim ? `Todos os fins de semana até ${formatarData(dados.dataFim)}` : dados.dataInicio ? formatarData(dados.dataInicio) : "Data por definir"}</span><span>· {dados.formatoEvento.trim() || nomeCategoriaPrincipal(dados.categoriaPrincipal)}</span>{dados.tags.slice(0, 2).map((tag) => <span key={tag}>· {tag}</span>)}</div>{dados.resumo && <p className="mt-4 line-clamp-3 text-sm leading-relaxed text-[#1A2E4F]/65">{dados.resumo}</p>}<div className="mt-4 border-t border-[#1A2E4F]/8 pt-4"><p className="text-[11px] font-bold uppercase tracking-wide text-[#1A2E4F]/40">Nesta página</p><div className="mt-2 flex flex-wrap gap-1.5">{[dados.descricao && "Sobre", dados.programaAtivo && dados.programa.length && "Programa", dados.acercaAtivo && "Acerca de", dados.fotos.length && "Fotos", dados.sublocalizacoes.length && "No recinto"].filter(Boolean).map((item) => <span key={String(item)} className="rounded bg-[#1A2E4F]/5 px-2 py-1 text-[11px] font-semibold text-[#1A2E4F]/55">{item}</span>)}</div></div></div>
        </aside>
      </div>
    </main>
  );
}
