"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentPropsWithoutRef, type CSSProperties, type ForwardRefExoticComponent, type PointerEvent as ReactPointerEvent, type RefAttributes } from "react";
import CartazFallback from "@/components/CartazFallback";
import ConviteOrganizador from "@/components/ConviteOrganizador";
import type FestaMapBase from "@/components/FestaMap";
import type { FestaMapHandle } from "@/components/FestaMap";
import Galeria from "@/components/Galeria";
import { useAuth } from "@/components/AuthProvider";
import { nomeCategoriaPrincipal } from "@/lib/criar-evento";
import type { FestasGeoJSON } from "@/lib/eventos";
import {
  CORES,
  ETIQUETAS,
  formatarDiaPrograma,
  formatarLocalizacao,
  distanciaKm,
  formatarKm,
  estimativaTempo,
  resumoDatas,
  type Coords,
  type FestaSelecionada,
} from "@/lib/festa-ui";

const FestaMap = dynamic(() => import("@/components/FestaMap"), {
  ssr: false,
  loading: () => <div className="absolute inset-0 animate-pulse bg-[#e9effa]" aria-label="A carregar mapa" />,
}) as unknown as ForwardRefExoticComponent<ComponentPropsWithoutRef<typeof FestaMapBase> & RefAttributes<FestaMapHandle>>;

type Painel =
  | { modo: "fechado" }
  | { modo: "detalhe"; festa: FestaSelecionada; deLista: boolean; detalhe: DetalheExtra | null }
  | { modo: "lista"; festas: FestaSelecionada[]; titulo?: string };

type FiltroMapa = "todas" | "a_decorrer" | "em_breve" | "futuro";
type NivelSheet = "minimo" | "medio" | "completo";
const ALTURA_SHEET: Record<NivelSheet, string> = { minimo: "34%", medio: "68%", completo: "100%" };
const ORDEM_SHEET: NivelSheet[] = ["minimo", "medio", "completo"];

function BotaoFechar({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Fechar"
      className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-[#1A2E4F]/70 shadow transition hover:bg-white hover:text-[#1A2E4F]"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M6 6l12 12M18 6L6 18" />
      </svg>
    </button>
  );
}

type ProgramaDia = { dia: string; eventos: { hora?: string; titulo: string }[] };
type DetalheExtra = {
  descricao: string | null;
  cartazUrl: string | null;
  fotos: string[];
  programa: ProgramaDia[] | null;
  caracteristicas: string[];
  subLocalizacoes?: { id: string; nome: string; tipo: string; descricao: string | null; lat: number; lng: number }[];
};

const DURACAO_CACHE_DETALHE = 5 * 60_000;
type DetalheEmCache = { valor: DetalheExtra | null; expiraEm: number };

function normalizarDetalhe(valor: unknown): DetalheExtra | null {
  if (!valor || typeof valor !== "object") return null;
  const dados = valor as Record<string, unknown>;
  const programa = Array.isArray(dados.programa)
    ? dados.programa.flatMap((dia) => {
        if (!dia || typeof dia !== "object") return [];
        const item = dia as Record<string, unknown>;
        const eventos = Array.isArray(item.eventos)
          ? item.eventos.flatMap((evento) => {
              if (!evento || typeof evento !== "object") return [];
              const linha = evento as Record<string, unknown>;
              return typeof linha.titulo === "string" && Boolean(linha.titulo.trim())
                ? [{ titulo: linha.titulo, ...(typeof linha.hora === "string" ? { hora: linha.hora } : {}) }]
                : [];
            })
          : [];
        return typeof item.dia === "string" && Boolean(item.dia.trim()) && eventos.length > 0
          ? [{ dia: item.dia, eventos }]
          : [];
      })
    : null;
  const subLocalizacoes = Array.isArray(dados.subLocalizacoes)
    ? dados.subLocalizacoes.flatMap((local) => {
        if (!local || typeof local !== "object") return [];
        const item = local as Record<string, unknown>;
        const { lat, lng } = item;
        if (
          typeof item.id !== "string" || typeof item.nome !== "string" || !item.nome.trim() ||
          typeof item.tipo !== "string" || !Number.isFinite(lat) || !Number.isFinite(lng) ||
          Math.abs(lat as number) > 90 || Math.abs(lng as number) > 180
        ) return [];
        return [{
          id: item.id,
          nome: item.nome,
          tipo: item.tipo,
          descricao: typeof item.descricao === "string" ? item.descricao : null,
          lat: lat as number,
          lng: lng as number,
        }];
      })
    : [];

  return {
    descricao: typeof dados.descricao === "string" ? dados.descricao : null,
    cartazUrl: typeof dados.cartazUrl === "string" ? dados.cartazUrl : null,
    fotos: Array.isArray(dados.fotos) ? dados.fotos.filter((foto): foto is string => typeof foto === "string" && Boolean(foto.trim())) : [],
    programa,
    caracteristicas: Array.isArray(dados.caracteristicas)
      ? dados.caracteristicas.filter((c): c is string => typeof c === "string" && Boolean(c.trim()))
      : [],
    subLocalizacoes,
  };
}

// Associa cada característica a um ícone, por palavra-chave.
function IconeCaracteristica({ nome }: { nome: string }) {
  const t = nome.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const p = (d: string, sw = "1.8") => (
    <svg className="size-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: d }} />
  );
  if (/(comida|petisco|gastronom|restaura|tasqu)/.test(t)) return p('<path d="M4 3v7a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V3M6 3v18M18 3c-1.7 0-3 2-3 5s1.3 4 3 4v9"/>');
  if (/(bebida|bar|fino|cervej|vinho|sangria)/.test(t)) return p('<path d="M6 3h12l-1 7a5 5 0 0 1-10 0L6 3ZM12 15v6M8 21h8"/>');
  if (/(musica|concerto|banda|dj|palco|som)/.test(t)) return p('<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="2.5"/><circle cx="16" cy="16" r="2.5"/>');
  if (/(fogo|artificio|pirotecn|foguete)/.test(t)) return p('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18"/>');
  if (/(prociss|religios|missa|igreja|santo|senhora)/.test(t)) return p('<path d="M12 2v6M9 5h6M6 22V11l6-3 6 3v11M6 22h12M10 22v-4h4v4"/>');
  if (/(feira|artesan|mercad)/.test(t)) return p('<path d="M3 9l1-5h16l1 5M4 9v11h16V9M4 9h16M9 13h6"/>');
  if (/(cortejo|desfile|marcha|gigant|rusga|folclor|etnograf)/.test(t)) return p('<circle cx="9" cy="7" r="3"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="8" r="2"/><path d="M21 21v-1a3 3 0 0 0-2-2.8"/>');
  if (/(gratuit|gratis|entrada livre)/.test(t)) return p('<path d="M3 8h18v8H3zM3 12h18M7 12v4M17 8v4"/>');
  if (/(familia|crianc|infantil)/.test(t)) return p('<circle cx="7" cy="6" r="2.5"/><circle cx="17" cy="6" r="2.5"/><path d="M4 21v-3a3 3 0 0 1 3-3M20 21v-3a3 3 0 0 0-3-3M12 12v9M9 16h6"/>');
  if (/(estacion|parque)/.test(t)) return p('<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 17V8h3.5a2.5 2.5 0 0 1 0 5H9"/>');
  if (/(praia|mar|maritim|rio|agua)/.test(t)) return p('<path d="M3 14c1.5 0 1.5-1.5 3-1.5s1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5M3 19c1.5 0 1.5-1.5 3-1.5s1.5 1.5 3 1.5 1.5-1.5 3-1.5 1.5 1.5 3 1.5 1.5-1.5 3-1.5"/>');
  if (/(acess|cadeira de rodas|mobilidade)/.test(t)) return p('<circle cx="12" cy="4" r="2"/><path d="M12 6v7h5l2 5M12 9l-3 1a4 4 0 1 0 4 6"/>');
  return p('<path d="M20 6 9 17l-5-5"/>', "2.2");
}

function IconeSublocalizacao({ tipo }: { tipo: string }) {
  const classe = "size-4";
  if (tipo === "estacionamento") return <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#2B6CB0]/10 text-sm font-extrabold text-[#2B6CB0]">P</span>;
  if (tipo === "entrada") return <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#20856D]/10 text-[#20856D]"><svg className={classe} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h15M14 6l6 6-6 6" /></svg></span>;
  if (tipo === "palco" || tipo === "after") return <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#7C4DAD]/10 text-[#7C4DAD]"><svg className={classe} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></svg></span>;
  if (tipo === "bar") return <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#B75B25]/10 text-[#B75B25]"><svg className={classe} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 3h10l-1 18H8L7 3Z" /><path d="M8 8h8" /></svg></span>;
  if (tipo === "wc") return <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#167F99]/10 text-[10px] font-extrabold text-[#167F99]">WC</span>;
  if (tipo === "primeiros_socorros") return <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#C43D4B]/10 text-[#C43D4B]"><svg className={classe} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg></span>;
  return <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#64748B]/10 text-[#64748B]"><svg className={classe} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2" /></svg></span>;
}

type CriticaPublica = { id: string; autor_nome: string | null; nota: number; texto: string; created_at: string };
const CORES_CRITICA = ["#EC2456", "#F97B16", "#1A2E4F", "#20856D"];

function quandoCritica(data: string) {
  const diferenca = Math.max(0, Date.now() - new Date(data).getTime());
  const dias = Math.floor(diferenca / 86_400_000);
  if (dias === 0) return "hoje";
  if (dias === 1) return "há 1 dia";
  if (dias < 30) return `há ${dias} dias`;
  const meses = Math.floor(dias / 30);
  return `há ${meses} mês${meses === 1 ? "" : "es"}`;
}

function FormularioCritica({ festaId, aoFechar, aoPublicar }: { festaId: string; aoFechar: () => void; aoPublicar: (critica: CriticaPublica) => void }) {
  const { utilizador } = useAuth();
  const [nome, setNome] = useState("");
  const [nota, setNota] = useState(0);
  const [notaHover, setNotaHover] = useState(0);
  const [texto, setTexto] = useState("");
  const [website, setWebsite] = useState("");
  const [erro, setErro] = useState("");
  const [enviada, setEnviada] = useState(false);
  const [estadoEnvio, setEstadoEnvio] = useState<"pendente" | "aprovada" | null>(null);
  const [aEnviar, setAEnviar] = useState(false);
  const [inicioFormulario] = useState(() => Date.now());
  const avaliacaoAtiva = notaHover || nota;
  const etiquetasNota = ["", "Muito fraco", "Fraco", "Razoável", "Bom", "Excelente"];

  useEffect(() => {
    if (!enviada) return;
    const temporizador = window.setTimeout(aoFechar, 2_000);
    return () => window.clearTimeout(temporizador);
  }, [enviada, aoFechar]);

  const enviar = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErro("");
    if (!nota || texto.trim().length < 20) {
      setErro("Escolhe uma nota e escreve pelo menos 20 caracteres.");
      return;
    }
    setAEnviar(true);
    try {
      const resposta = await fetch("/api/criticas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          festaId,
          nome,
          nota,
          texto,
          website,
          tempoPreenchimento: Date.now() - inicioFormulario,
        }),
      });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok) throw new Error(dados?.error ?? "Não foi possível enviar a crítica.");
      const aprovada = dados?.estado === "aprovada";
      setEstadoEnvio(aprovada ? "aprovada" : "pendente");
      if (aprovada && dados?.critica && typeof dados.critica.id === "string") aoPublicar(dados.critica as CriticaPublica);
      setEnviada(true);
    } catch (causa) {
      setErro(causa instanceof Error ? causa.message : "Não foi possível enviar a crítica.");
    } finally {
      setAEnviar(false);
    }
  };

  if (enviada) return <div role="status" className="mt-3 flex items-center gap-2 rounded-lg border border-[#20856D]/20 bg-[#20856D]/[0.05] px-3 py-2.5 text-xs text-[#1A2E4F]/70"><svg className="size-4 shrink-0 text-[#20856D]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m5 12 4 4L19 6" /></svg><span>{estadoEnvio === "aprovada" ? "Crítica publicada." : "Crítica enviada para validação."}</span></div>;

  return <form onSubmit={enviar} className="mt-4 rounded-xl border border-[#EC2456]/20 bg-[#fff8fa] p-4">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[#102745]">Partilha a tua experiência</p><p className="mt-0.5 text-[11px] leading-relaxed text-[#1A2E4F]/60">{utilizador ? "Com uma sessão Google válida, a crítica é publicada logo." : "Não precisas de conta; nesse caso a crítica é revista antes de ficar pública."}</p></div><button type="button" onClick={aoFechar} className="text-xs font-bold text-[#1A2E4F]/55 hover:text-[#EC2456]">Cancelar</button></div>
    <fieldset className="mt-4"><legend className="text-xs font-semibold text-[#1A2E4F]/75">A tua avaliação</legend><div onMouseLeave={() => setNotaHover(0)} role="radiogroup" aria-label="Avaliação de uma a cinco estrelas" className="mt-1.5 flex items-center gap-1"><div className="flex gap-1">{[1, 2, 3, 4, 5].map((estrela) => <button key={estrela} type="button" role="radio" onMouseEnter={() => setNotaHover(estrela)} onFocus={() => setNotaHover(estrela)} onBlur={() => setNotaHover(0)} onKeyDown={(event) => { if (event.key === "ArrowRight" || event.key === "ArrowUp") { event.preventDefault(); setNota(Math.min(5, estrela + 1)); } if (event.key === "ArrowLeft" || event.key === "ArrowDown") { event.preventDefault(); setNota(Math.max(1, estrela - 1)); } }} onClick={() => setNota(estrela)} aria-label={`${estrela} estrela${estrela > 1 ? "s" : ""}`} aria-checked={nota === estrela} className={`text-2xl leading-none transition duration-150 hover:scale-110 focus-visible:scale-110 focus-visible:outline-none ${estrela <= avaliacaoAtiva ? "text-[#F97B16]" : "text-[#1A2E4F]/15"}`}>★</button>)}</div><span aria-live="polite" className={`ml-2 text-xs font-semibold transition ${avaliacaoAtiva ? "text-[#F97B16]" : "text-[#1A2E4F]/40"}`}>{avaliacaoAtiva ? etiquetasNota[avaliacaoAtiva] : "Escolhe uma nota"}</span></div></fieldset>
    {utilizador ? <p className="mt-4 rounded-lg bg-white px-3 py-2.5 text-xs text-[#1A2E4F]/70">A publicar como <span className="font-semibold text-[#102745]">{utilizador.nome || utilizador.email || "utilizador Google"}</span>.</p> : <label className="mt-4 block text-xs font-semibold text-[#1A2E4F]/75">Nome <span className="font-normal text-[#1A2E4F]/45">(opcional)</span><input value={nome} onChange={(event) => setNome(event.target.value)} maxLength={60} autoComplete="name" placeholder="Como queres aparecer" className="mt-1.5 w-full rounded-lg border border-[#1A2E4F]/15 bg-white px-3 py-2.5 text-sm font-normal outline-none transition focus:border-[#EC2456]" /></label>}
    <label className="mt-3 block text-xs font-semibold text-[#1A2E4F]/75">A tua crítica<textarea value={texto} onChange={(event) => setTexto(event.target.value)} maxLength={1200} required className="mt-1.5 min-h-24 w-full resize-none rounded-lg border border-[#1A2E4F]/15 bg-white p-3 text-sm font-normal outline-none transition focus:border-[#EC2456]" placeholder="O que gostaste e o que podia melhorar?" /></label>
    <input name="website" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
    <div className="mt-1 flex justify-between text-[11px] text-[#1A2E4F]/45"><span>Mínimo de 20 caracteres</span><span>{texto.length}/1200</span></div>
    {erro && <p role="alert" className="mt-3 text-xs font-semibold text-[#c43d4b]">{erro}</p>}
    <button type="submit" disabled={aEnviar} className="mt-4 w-full rounded-lg bg-[#EC2456] py-2.5 text-sm font-bold text-white transition hover:bg-[#d11a47] disabled:cursor-wait disabled:opacity-60">{aEnviar ? "A enviar…" : utilizador ? "Publicar crítica" : "Enviar para validação"}</button>
  </form>;
}

function DetalheFesta({
  festa,
  detalhe,
  deLista,
  minhaLoc,
  pedirLocalizacao,
  aoVoltar,
  aoFechar,
  aoFocarSublocalizacao,
  aoMostrarSublocalizacoes,
}: {
  festa: FestaSelecionada;
  detalhe: DetalheExtra | null;
  deLista: boolean;
  minhaLoc: Coords | null;
  pedirLocalizacao: () => void;
  aoVoltar: () => void;
  aoFechar: () => void;
  aoFocarSublocalizacao: (local: { lng: number; lat: number; nome: string }) => void;
  aoMostrarSublocalizacoes: (locais: { lng: number; lat: number; nome: string; tipo: string }[]) => void;
}) {
  const p = festa.props;
  const [lng, lat] = festa.lngLat;
  const cor = CORES[p.estado_temporal];
  const extra = detalhe;
  const { guardado, alternar } = useAuth();
  const estaGuardado = guardado(p.id);
  const [aba, setAba] = useState<"visao" | "cartaz" | "criticas" | "acerca">("visao");
  const [menuDirecoes, setMenuDirecoes] = useState(false);
  const [formularioCritica, setFormularioCritica] = useState(false);
  const [criticas, setCriticas] = useState<CriticaPublica[]>([]);
  const [aCarregarCriticas, setACarregarCriticas] = useState(true);
  const [avisoGuardar, setAvisoGuardar] = useState<{ mensagem: string; erro?: boolean } | null>(null);
  const [aGuardar, setAGuardar] = useState(false);
  const [mostrarRecintoNoMapa, setMostrarRecintoNoMapa] = useState(true);
  const conteudoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!avisoGuardar) return;
    const temporizador = window.setTimeout(() => setAvisoGuardar(null), 2_000);
    return () => window.clearTimeout(temporizador);
  }, [avisoGuardar]);

  useEffect(() => {
    aoMostrarSublocalizacoes(mostrarRecintoNoMapa ? (extra?.subLocalizacoes ?? []) : []);
    return () => aoMostrarSublocalizacoes([]);
  }, [extra, mostrarRecintoNoMapa, aoMostrarSublocalizacoes]);

  useEffect(() => {
    let ativo = true;
    fetch(`/api/criticas?festa=${encodeURIComponent(p.id)}`)
      .then((resposta) => resposta.ok ? resposta.json() : [])
      .then((dados) => {
        if (!ativo) return;
        setCriticas(Array.isArray(dados) ? dados.filter((critica): critica is CriticaPublica => (
          critica && typeof critica.id === "string" && typeof critica.nota === "number" && typeof critica.texto === "string"
        )) : []);
      })
      .catch(() => { if (ativo) setCriticas([]); })
      .finally(() => { if (ativo) setACarregarCriticas(false); });
    return () => { ativo = false; };
  }, [p.id]);

  const mediaCriticas = criticas.length ? criticas.reduce((total, critica) => total + critica.nota, 0) / criticas.length : 0;

  const cartaz = typeof extra?.cartazUrl === "string" ? extra.cartazUrl : p.cartaz_url;
  const fotos = Array.isArray(extra?.fotos) ? extra.fotos.filter(Boolean) : [];
  const subLocalizacoes = (extra?.subLocalizacoes ?? []).filter(
    (local) => Number.isFinite(local.lat) && Number.isFinite(local.lng) && local.nome.trim().length > 0,
  );
  const descricao = extra?.descricao;
  const caracteristicas = extra?.caracteristicas ?? [];
  const localizacao = formatarLocalizacao(p.freguesia, p.concelho, p.distrito);
  const datas = resumoDatas(p.data_inicio, p.data_fim, p.tipo_recorrencia, p.dias_semana);
  const abrirDirecoes = () => {
    const destino = `${lat},${lng}`;
    const telemovel = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (!telemovel) {
      setMenuDirecoes((aberto) => !aberto);
      return;
    }
    if (/Android/i.test(navigator.userAgent)) {
      window.location.assign(`geo:0,0?q=${destino}(${encodeURIComponent(p.nome)})`);
      return;
    }
    window.location.assign(`https://maps.apple.com/?daddr=${destino}`);
  };
  const selecionarAba = (proximaAba: "visao" | "cartaz" | "criticas" | "acerca") => {
    setMenuDirecoes(false);
    setAba(proximaAba);
    conteudoRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };
  const guardarFesta = async () => {
    if (aGuardar) return;
    setMenuDirecoes(false);
    setAGuardar(true);
    try {
      const resultado = await alternar(p.id);
      if (resultado === "guardado") setAvisoGuardar({ mensagem: "Festa guardada no teu perfil." });
      if (resultado === "removido") setAvisoGuardar({ mensagem: "Festa removida dos guardados." });
      if (resultado === "erro") setAvisoGuardar({ mensagem: "Não foi possível atualizar os guardados.", erro: true });
    } finally {
      setAGuardar(false);
    }
  };

  return (
    <div className="relative flex h-full flex-col">
      <BotaoFechar onClick={aoFechar} />
      {deLista && (
        <button
          type="button"
          onClick={aoVoltar}
          className="absolute left-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/90 text-[#1A2E4F]/70 shadow transition hover:bg-white hover:text-[#1A2E4F]"
          aria-label="Voltar à lista"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      )}

      <div className="relative shrink-0">
        {cartaz ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cartaz} alt={`Cartaz de ${p.nome}`} decoding="async" className="h-40 w-full object-cover" />
        ) : <CartazFallback nome={p.nome} categoria={p.categoria_principal} className="h-40 w-full" />}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#102745]/80 via-[#102745]/25 to-transparent px-4 pb-3 pt-8 text-white">
          <h2 className="pr-36 text-lg font-bold leading-tight drop-shadow-sm">{p.nome}</h2>
          <div className="mt-0.5 flex min-w-0 items-center gap-1.5 pr-24 text-xs"><span className="min-w-0 truncate text-white/80">{localizacao}</span>{typeof p.media_criticas === "number" && p.total_criticas > 0 && <span className="shrink-0 font-bold text-[#FFD166] drop-shadow-sm">{p.media_criticas.toFixed(1).replace(".", ",")} ★</span>}</div>
          <div className="mt-2 flex flex-wrap items-center gap-1.5 pr-20 text-[11px] font-semibold">
            <span className="text-white"><span className="block">{datas.principal}</span>{datas.secundario && <span className="mt-0.5 block text-[10px] font-medium text-white/75">{datas.secundario}</span>}</span>
            <span className="text-white/75 before:mr-1.5 before:content-['·']">{p.formato_evento || nomeCategoriaPrincipal(p.categoria_principal)}</span>
          </div>
        </div>
        <span
          className="absolute right-4 top-12 inline-flex items-center gap-1.5 rounded-[3px] bg-white/95 px-2 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm"
          style={{ color: cor }}
        >
          <span className="size-1.5 rounded-full" style={{ backgroundColor: cor }} />
          {ETIQUETAS[p.estado_temporal]}
        </span>
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-[#1A2E4F]/10 bg-white px-2">
        {([['visao', 'Visão geral'], ['cartaz', 'Cartaz'], ['criticas', 'Críticas'], ['acerca', 'Acerca de']] as const).map(([id, texto]) => (
          <button key={id} type="button" onClick={() => selecionarAba(id)} className={`relative px-1 py-3 text-xs font-semibold transition-colors duration-150 ${aba === id ? 'text-[#EC2456]' : 'text-[#1A2E4F]/60 hover:text-[#EC2456]'}`}>
            {texto}{aba === id && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-[#EC2456]" />}
          </button>
        ))}
      </div>

      <div className="grid shrink-0 grid-cols-4 border-b border-[#1A2E4F]/10 bg-white px-3 py-2 text-center text-[11px] font-medium text-[#1A2E4F]">
        <div className="relative">
          <button type="button" onClick={abrirDirecoes} aria-expanded={menuDirecoes} className="group flex w-full flex-col items-center gap-1.5 rounded-lg py-1 transition-colors duration-150 hover:bg-[#EC2456]/[0.06] hover:text-[#EC2456]">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#EC2456]/10 text-[#EC2456] transition-colors duration-150 group-hover:bg-[#EC2456]/20"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 11l19-9-9 19-2-8-8-2z" /></svg></span>Direções
          </button>
          {menuDirecoes && <div className="menu-direcoes-entrada absolute left-0 top-full z-20 mt-2 w-36 overflow-hidden rounded-lg border border-[#1A2E4F]/10 bg-white p-1 text-left shadow-xl">
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer" onClick={() => setMenuDirecoes(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#1A2E4F] transition hover:bg-[#EC2456]/[0.07] hover:text-[#EC2456]">
              <svg aria-hidden="true" width="16" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M12 2a7 7 0 0 0-7 7c0 5.1 7 13 7 13s7-7.9 7-13a7 7 0 0 0-7-7Z"/><path fill="#34A853" d="M5.2 10.5C6.4 15.3 12 22 12 22s2.7-3 4.7-6.2l-5-5.3Z"/><circle cx="12" cy="9" r="3" fill="#FBBC04"/></svg>
              Google Maps
            </a>
            <a href={`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`} target="_blank" rel="noopener noreferrer" onClick={() => setMenuDirecoes(false)} className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-semibold text-[#1A2E4F] transition hover:bg-[#EC2456]/[0.07] hover:text-[#EC2456]">
              <svg aria-hidden="true" width="19" height="18" viewBox="0 0 24 24" fill="none" stroke="#33CCFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M7 16.5a7 7 0 1 1 10 0c-.9 1.1-2.3 1.8-5 1.8s-4.1-.7-5-1.8Z"/><path d="M9 19.5c.7 1 1.7 1.5 3 1.5s2.3-.5 3-1.5M8 10.5h.01M16 10.5h.01"/><path d="M4 14.5l-1.5 1M20 14.5l1.5 1"/></svg>
              Waze
            </a>
          </div>}
        </div>
        <button type="button" onClick={() => void guardarFesta()} disabled={aGuardar} aria-busy={aGuardar} aria-pressed={estaGuardado} className={`group flex cursor-pointer flex-col items-center gap-1.5 rounded-lg py-1 transition-colors duration-150 hover:bg-[#F97B16]/[0.06] hover:text-[#EC2456] disabled:cursor-wait disabled:opacity-60 ${estaGuardado ? "text-[#EC2456]" : ""}`} aria-label={estaGuardado ? "Remover dos guardados" : "Guardar festa"}>
          <span className="flex size-9 items-center justify-center rounded-full bg-[#EC2456]/10 text-[#EC2456] transition-colors duration-150 group-hover:bg-[#EC2456]/20"><svg width="17" height="17" viewBox="0 0 24 24" fill={estaGuardado ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg></span>{estaGuardado ? "Guardado" : "Guardar"}
        </button>
        <button type="button" onClick={() => selecionarAba("cartaz")} className="group flex flex-col items-center gap-1.5 rounded-lg py-1 transition-colors duration-150 hover:bg-[#EC2456]/[0.06] hover:text-[#EC2456]">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#EC2456]/10 text-[#EC2456] transition-colors duration-150 group-hover:bg-[#EC2456]/20"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg></span>Cartaz
        </button>
        <button type="button" onClick={() => { setMenuDirecoes(false); void navigator.share?.({ title: p.nome, url: `${window.location.origin}/festas/${p.concelho_slug}/${p.slug}` }).catch(() => {}); }} className="group flex flex-col items-center gap-1.5 rounded-lg py-1 transition-colors duration-150 hover:bg-[#F97B16]/[0.06] hover:text-[#EC2456]">
          <span className="flex size-9 items-center justify-center rounded-full bg-[#EC2456]/10 text-[#EC2456] transition-colors duration-150 group-hover:bg-[#EC2456]/20"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4" /></svg></span>Partilhar
        </button>
      </div>

      <div ref={conteudoRef} className="flex-1 overflow-y-auto p-5">
        {aba === "visao" && <>
        <p className="sr-only">
          <span className="text-[#EC2456]">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2" />
            </svg>
          </span>
          {localizacao}
        </p>

        {minhaLoc ? (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-[#1A2E4F]/65">
            <span className="text-[#EC2456]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0a3 3 0 1 1-6 0m6 0V9l-2-4H7L5 9v7m0 0a3 3 0 1 0 6 0" /></svg>
            </span>
            <span>
              Estás a <strong>{estimativaTempo(distanciaKm(minhaLoc, { lat, lng }))}</strong> de carro
              {" · "}{formatarKm(distanciaKm(minhaLoc, { lat, lng }))}
              <span className="ml-1 text-[#1A2E4F]/45">(aprox.)</span>
            </span>
          </div>
        ) : (
          <button
            type="button"
            onClick={pedirLocalizacao}
            className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-[#1A2E4F]/60 transition hover:text-[#EC2456]"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2" /></svg>
            Ver a que distância estás
          </button>
        )}

        {subLocalizacoes.length > 0 && (
          <section className="mt-5 border-t border-[#1A2E4F]/10 pt-4">
            <div className="flex items-center justify-between gap-3"><h3 className="text-xs font-bold uppercase tracking-wide text-[#1A2E4F]/45">No recinto</h3><button type="button" onClick={() => setMostrarRecintoNoMapa((visivel) => !visivel)} aria-pressed={mostrarRecintoNoMapa} className="cursor-pointer text-[11px] font-bold text-[#EC2456] transition hover:text-[#d11a47]">{mostrarRecintoNoMapa ? "Ocultar no mapa" : "Mostrar no mapa"}</button></div>
            <div className="mt-2 grid grid-cols-2 gap-2 max-[360px]:grid-cols-1">
              {subLocalizacoes.map((local) => (
                <button key={local.id} type="button" onClick={() => aoFocarSublocalizacao(local)} className="group flex min-h-20 items-center gap-2.5 rounded-lg border border-[#1A2E4F]/10 p-3 text-left transition hover:border-[#EC2456]/35 hover:bg-[#EC2456]/[0.035]">
                  <IconeSublocalizacao tipo={local.tipo} />
                  <span className="min-w-0 whitespace-normal break-words text-[13px] font-semibold leading-snug text-[#102745] transition group-hover:text-[#EC2456]">{local.nome}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {descricao && (
          <section className="mt-6 border-t border-[#1A2E4F]/10 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#1A2E4F]/45">Sobre</h3>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#1A2E4F]/75">{descricao}</p>
          </section>
        )}

        {fotos.length > 0 && (
          <section className="mt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#1A2E4F]/45">Fotos</h3>
            <div className="mt-2">
              <Galeria fotos={fotos} variante="painel" />
            </div>
          </section>
        )}

        <section className="mt-5 border-t border-[#1A2E4F]/10 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><h3 className="text-sm font-bold text-[#102745]">Opiniões recentes</h3>{criticas.length > 0 && <span className="text-xs font-semibold text-[#F97B16]">{mediaCriticas.toFixed(1).replace(".", ",")} ★</span>}</div>
            <button type="button" onClick={() => selecionarAba("criticas")} className="text-xs font-semibold text-[#EC2456] transition hover:text-[#d11a47]">Ver todas</button>
          </div>
          <div className="mt-2.5 space-y-2.5">
            {aCarregarCriticas && <p className="text-xs text-[#1A2E4F]/45">A carregar opiniões…</p>}
            {!aCarregarCriticas && criticas.length === 0 && <p className="text-xs text-[#1A2E4F]/55">Ainda não há opiniões aprovadas.</p>}
            {criticas.slice(0, 2).map((critica) => <button key={critica.id} type="button" onClick={() => selecionarAba("criticas")} className="block w-full text-left">
              <p className="line-clamp-1 text-[13px] leading-relaxed text-[#1A2E4F]/75">“{critica.texto}”</p>
              <p className="mt-0.5 text-[11px] text-[#1A2E4F]/55">{critica.autor_nome || "Participante"} · <span className="text-[#F97B16]">{"★".repeat(critica.nota)}</span></p>
            </button>)}
          </div>
        </section>

        {extra?.programa && extra.programa.length > 0 && (
          <section className="mt-6 border-t border-[#1A2E4F]/10 pt-5">
            <h3 className="text-xs font-bold uppercase tracking-wide text-[#1A2E4F]/45">Programa</h3>
            <div className="mt-2 space-y-3">
              {extra.programa.map((dia) => (
                <div key={dia.dia}>
                  <p className="text-[13px] font-bold capitalize text-[#EC2456]">{formatarDiaPrograma(dia.dia)}</p>
                  <ul className="mt-1 space-y-1">
                    {dia.eventos.map((ev, i) => (
                      <li key={i} className="flex gap-2.5 text-[13px] text-[#1A2E4F]/75">
                        {ev.hora && <span className="w-11 shrink-0 font-semibold tabular-nums text-[#1A2E4F]">{ev.hora}</span>}
                        <span>{ev.titulo}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        </>}

        {aba === "cartaz" && (
          <section>
            <div className="flex items-start justify-between px-1">
              <div><p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#EC2456]">Edição {p.ano}</p><h3 className="mt-1 text-lg font-bold text-[#102745]">Cartaz oficial</h3></div>
              <span className="rounded-full bg-[#F97B16]/10 px-2.5 py-1 text-[11px] font-bold text-[#d65c00]">Confirmado</span>
            </div>
            {cartaz ? (
              <div className="mt-3 rounded-lg border border-[#1A2E4F]/10 bg-[#f8fafb] p-3">
                <div className="hidden" />
                <div className="hidden" />
                <div className="mx-auto overflow-hidden rounded-md border border-[#1A2E4F]/10 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cartaz} alt={`Cartaz de ${p.nome}`} loading="lazy" decoding="async" className="w-full object-contain" />
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-[#f3f6f8] p-4 text-sm text-[#1A2E4F]/65">O cartaz desta edição será publicado em breve.</p>
            )}
            <div className="mt-4 rounded-xl border border-[#1A2E4F]/10 bg-[#f8fafb] px-4 py-3"><p className="text-[11px] font-bold uppercase tracking-wide text-[#1A2E4F]/45">Marca na agenda</p><p className="mt-1 text-sm font-semibold text-[#102745]">{datas.principal}</p>{datas.secundario && <p className="mt-0.5 text-xs text-[#1A2E4F]/55">{datas.secundario}</p>}</div>
          </section>
        )}

        {aba === "criticas" && (
          <section>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-[#102745]">Críticas</h3>
                <p className="mt-0.5 text-xs text-[#1A2E4F]/55">Experiências de quem já participou</p>
              </div>
              <button type="button" onClick={() => { setFormularioCritica((aberto) => !aberto); requestAnimationFrame(() => conteudoRef.current?.scrollTo({ top: 0, behavior: "smooth" })); }} className="shrink-0 rounded-md bg-[#EC2456] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-[#d11a47]">
                {formularioCritica ? "Fechar" : "Escrever crítica"}
              </button>
            </div>

            {formularioCritica && <FormularioCritica festaId={p.id} aoFechar={() => setFormularioCritica(false)} aoPublicar={(critica) => setCriticas((atuais) => atuais.some((atual) => atual.id === critica.id) ? atuais : [critica, ...atuais])} />}

            <div className="mt-5 grid grid-cols-[1fr_auto] items-center gap-5 border-y border-[#1A2E4F]/10 py-4">
              <div className="space-y-1.5">
                {[5, 4, 3, 2, 1].map((estrela) => (
                  <div key={estrela} className="flex items-center gap-2 text-[11px] text-[#1A2E4F]/65"><span className="w-2">{estrela}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1A2E4F]/[0.07]"><div className="h-full rounded-full bg-[#F97B16]" style={{ width: `${criticas.length ? (criticas.filter((critica) => critica.nota === estrela).length / criticas.length) * 100 : 0}%` }} /></div></div>
                ))}
              </div>
              <div className="text-right"><p className="text-4xl font-medium leading-none text-[#102745]">{criticas.length ? mediaCriticas.toFixed(1).replace(".", ",") : "—"}</p><p className="mt-1 text-sm tracking-[0.08em] text-[#F97B16]">★★★★★</p><p className="mt-1 text-[11px] text-[#1A2E4F]/60">{criticas.length} crítica{criticas.length === 1 ? "" : "s"}</p></div>
            </div>

            <p className="mt-3 text-[11px] text-[#1A2E4F]/50">As críticas refletem a opinião dos participantes.</p>
            <div className="mt-4 divide-y divide-[#1A2E4F]/10">
              {aCarregarCriticas && <p className="py-5 text-center text-sm text-[#1A2E4F]/55">A carregar críticas…</p>}
              {!aCarregarCriticas && criticas.length === 0 && <p className="py-5 text-center text-sm text-[#1A2E4F]/55">Ainda não há críticas aprovadas. Sê a primeira pessoa a partilhar a experiência.</p>}
              {criticas.map((critica, indice) => { const nome = critica.autor_nome || "Participante"; const iniciais = nome.split(/\s+/).map((parte) => parte[0]).join("").slice(0, 2).toUpperCase(); return <article key={critica.id} className="py-4 first:pt-1">
                <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white" style={{ backgroundColor: CORES_CRITICA[indice % CORES_CRITICA.length] }}>{iniciais}</span><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><div><h4 className="text-sm font-semibold text-[#102745]">{nome}</h4><p className="mt-0.5 text-[11px] text-[#1A2E4F]/55">{quandoCritica(critica.created_at)}</p></div><span className="text-sm tracking-wide text-[#F97B16]">{"★".repeat(critica.nota)}<span className="text-[#1A2E4F]/15">{"★".repeat(5 - critica.nota)}</span></span></div><p className="mt-2 text-[13px] leading-relaxed text-[#1A2E4F]/75">{critica.texto}</p></div></div>
              </article>; })}
            </div>
          </section>
        )}

        {aba === "acerca" && (
          <section className="space-y-5">
            <div>
              <h3 className="text-base font-bold text-[#102745]">Acerca de {p.nome}</h3>
              {descricao ? (
                <p className="mt-2 text-[13px] leading-relaxed text-[#1A2E4F]/75">{descricao}</p>
              ) : (
                <p className="mt-2 text-[13px] leading-relaxed text-[#1A2E4F]/55">Sem descrição disponível para esta festa.</p>
              )}
            </div>

            {caracteristicas.length > 0 && (
              <div className="border-t border-[#1A2E4F]/10 pt-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-[#1A2E4F]/45">O que vais encontrar</h4>
                <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
                  {caracteristicas.map((c) => (
                    <li key={c} className="flex items-center gap-2.5 text-[13px] text-[#1A2E4F]/80">
                      <span className="shrink-0 text-[#20856D]"><IconeCaracteristica nome={c} /></span>
                      <span className="leading-snug">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <dl className="space-y-3 border-t border-[#1A2E4F]/10 pt-4">
              <div className="flex gap-3">
                <dt className="mt-0.5 shrink-0 text-[#007c91]"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2" /></svg></dt>
                <dd className="text-sm text-[#1A2E4F]/80"><span className="font-semibold text-[#102745]">Onde</span><br />{localizacao}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="mt-0.5 shrink-0 text-[#007c91]"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg></dt>
                <dd className="text-sm text-[#1A2E4F]/80"><span className="font-semibold text-[#102745]">Quando</span><br />{datas.principal}{datas.secundario && <><br /><span className="text-xs text-[#1A2E4F]/55">{datas.secundario}</span></>}</dd>
              </div>
              <div className="flex gap-3">
                <dt className="mt-0.5 shrink-0 text-[#007c91]"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="2" /><circle cx="16" cy="16" r="2" /></svg></dt>
                <dd className="text-sm text-[#1A2E4F]/80"><span className="font-semibold text-[#102745]">Tipo</span><br /><span>{nomeCategoriaPrincipal(p.categoria_principal)}{p.formato_evento ? ` · ${p.formato_evento}` : ""}</span>{p.tags_evento?.length > 0 && <span className="mt-1 block text-xs text-[#1A2E4F]/55">{p.tags_evento.join(" · ")}</span>}</dd>
              </div>
            </dl>
          </section>
        )}

        <a href={`/festas/${p.concelho_slug}/${p.slug}`}
          className="mt-6 flex items-center justify-center gap-1.5 rounded bg-[#EC2456] py-2.5 text-sm font-bold text-white transition hover:bg-[#d11a47]">
          Ver página da festa
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
      {avisoGuardar && <div className="pointer-events-none fixed inset-x-0 bottom-[calc(2.25rem+1rem)] z-[130] flex justify-center px-4"><div role="status" aria-live="polite" className={`toast-entrada flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold shadow-xl ${avisoGuardar.erro ? "bg-[#B41E47] text-white" : "bg-[#102745] text-white"}`}><svg className={`size-4 shrink-0 ${avisoGuardar.erro ? "text-white" : "text-[#7ee2c0]"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d={avisoGuardar.erro ? "M12 9v4m0 4h.01M5.9 19h12.2c1.5 0 2.46-1.62 1.73-2.95L13.73 5.5c-.75-1.33-2.67-1.33-3.44 0L4.17 16.05C3.44 17.38 4.4 19 5.9 19Z" : "m5 12 4 4L19 6"} /></svg>{avisoGuardar.mensagem}</div></div>}
    </div>
  );
}

function ListaFestas({
  festas,
  minhaLoc,
  aoEscolher,
  aoFechar,
  titulo,
  aCarregarId,
}: {
  festas: FestaSelecionada[];
  minhaLoc: Coords | null;
  aoEscolher: (f: FestaSelecionada) => void;
  aoFechar: () => void;
  titulo?: string;
  aCarregarId?: string;
}) {
  const [filtro, setFiltro] = useState<"todas" | "a_decorrer" | "em_breve">("todas");
  const [ordem, setOrdem] = useState<"data" | "distancia">("data");
  const { guardado } = useAuth();
  const contagens = {
    todas: festas.length,
    a_decorrer: festas.filter((f) => f.props.estado_temporal === "a_decorrer").length,
    em_breve: festas.filter((f) => f.props.estado_temporal === "em_breve").length,
  };
  const filtradas = festas.filter((f) => filtro === "todas" || f.props.estado_temporal === filtro);
  const ordenadas = [...filtradas].sort((a, b) => {
    if (ordem === "distancia" && minhaLoc) {
      return distanciaKm(minhaLoc, { lat: a.lngLat[1], lng: a.lngLat[0] }) - distanciaKm(minhaLoc, { lat: b.lngLat[1], lng: b.lngLat[0] });
    }
    const prioridade = { a_decorrer: 0, em_breve: 1, futuro: 2 } as const;
    return prioridade[a.props.estado_temporal] - prioridade[b.props.estado_temporal]
      || a.props.data_inicio.localeCompare(b.props.data_inicio);
  });
  const concelhos = [...new Set(festas.map((f) => f.props.concelho))];

  return (
    <div className="relative flex h-full flex-col">
      <BotaoFechar onClick={aoFechar} />
      <div className="shrink-0 border-b border-[#1A2E4F]/10 p-5 pb-4 pr-14">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-[#1A2E4F]">{titulo ?? `${festas.length} festas nesta zona`}</h2>
          {minhaLoc && (
            <button type="button" onClick={() => setOrdem((atual) => atual === "data" ? "distancia" : "data")} className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#1A2E4F]/12 px-2.5 py-1.5 text-[11px] font-bold text-[#1A2E4F]/70 transition hover:border-[#EC2456]/35 hover:text-[#EC2456]">
              {ordem === "distancia" ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="8" /><path d="m12 8 2.5 5L12 16l-2.5-3L12 8Z" /></svg> : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>}
              {ordem === "distancia" ? "Mais perto" : "Por data"}
            </button>
          )}
        </div>
        <p className="mt-0.5 truncate text-sm text-[#1A2E4F]/60">{concelhos.join(" · ")}</p>
        <div className="mt-3 grid grid-cols-3 rounded-lg bg-[#1A2E4F]/[0.045] p-1">
          {([
            ["todas", "Todas"],
            ["a_decorrer", "Agora"],
            ["em_breve", "Em breve"],
          ] as const).map(([id, texto]) => (
            <button key={id} type="button" onClick={() => setFiltro(id)} className={`rounded-md px-1 py-1.5 text-[11px] font-bold transition ${filtro === id ? "bg-white text-[#EC2456] shadow-sm" : "text-[#1A2E4F]/55 hover:text-[#1A2E4F]"}`}>
              {texto} <span className="ml-0.5 opacity-60">{contagens[id]}</span>
            </button>
          ))}
        </div>
      </div>

      <ul className="flex-1 space-y-3 overflow-y-auto p-4">
        {ordenadas.length === 0 && (
          <li className="rounded-lg border border-dashed border-[#1A2E4F]/15 px-4 py-6 text-center text-sm text-[#1A2E4F]/55">
            {festas.length === 0 ? "Não encontrámos nenhuma festa com essa pesquisa." : `Não há festas ${filtro === "a_decorrer" ? "a decorrer" : "em breve"} nesta zona.`}
            {festas.length > 0 && <button type="button" onClick={() => setFiltro("todas")} className="mt-2 block w-full text-xs font-bold text-[#EC2456]">Ver todas</button>}
          </li>
        )}
        {ordenadas.map((f) => {
          const p = f.props;
          const cor = CORES[p.estado_temporal];
          const estaGuardado = guardado(p.id);
          const localizacao = formatarLocalizacao(p.freguesia, p.concelho, p.distrito);
          const datas = resumoDatas(p.data_inicio, p.data_fim, p.tipo_recorrencia, p.dias_semana);
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => aoEscolher(f)}
                disabled={Boolean(aCarregarId)}
                aria-busy={aCarregarId === p.id}
                className="group relative w-full overflow-hidden rounded-md text-left ring-1 ring-[#1A2E4F]/10 transition hover:-translate-y-0.5 hover:shadow-lg hover:ring-[#EC2456]/30 disabled:cursor-wait disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                <div className="relative h-24 w-full overflow-hidden">
                  {p.cartaz_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.cartaz_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : <CartazFallback nome={p.nome} categoria={p.categoria_principal} />}
                  <span
                    className="absolute left-2.5 top-2.5 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide shadow-sm"
                    style={{ color: cor }}
                  >
                    <span className="size-1.5 rounded-full" style={{ backgroundColor: cor }} />
                    {ETIQUETAS[p.estado_temporal]}
                  </span>
                  {minhaLoc && (
                    <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-[#EC2456] shadow-sm">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 16H9m10 0a3 3 0 1 1-6 0m6 0V9l-2-4H7L5 9v7m0 0a3 3 0 1 0 6 0" /></svg>
                      {estimativaTempo(distanciaKm(minhaLoc, { lat: f.lngLat[1], lng: f.lngLat[0] }))}
                    </span>
                  )}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2"><span className="min-w-0 truncate text-sm font-bold text-[#1A2E4F]">{p.nome}</span><span className="flex shrink-0 items-center gap-1.5">{typeof p.media_criticas === "number" && p.total_criticas > 0 && <span className="text-xs font-bold text-[#F97B16]">{p.media_criticas.toFixed(1).replace(".", ",")} ★</span>}{estaGuardado && <span aria-label="Festa guardada" title="Festa guardada" className="flex size-5 items-center justify-center rounded-full bg-[#EC2456]/10 text-[#EC2456]"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"><path d="M6 3h12v18l-6-4-6 4z" /></svg></span>}</span></div>
                  <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-[#1A2E4F]/60">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#EC2456" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0"><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2" /></svg>
                    {localizacao}
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded bg-[#1A2E4F]/5 px-2 py-0.5 text-[11px] font-semibold text-[#1A2E4F]">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v4M16 2v4M3 10h18" /><rect x="5" y="4" width="14" height="16" rx="1" /></svg>
                      {datas.principal}
                    </span>
                    {datas.secundario && <span className="basis-full pl-0.5 text-[10px] font-medium text-[#1A2E4F]/50">{datas.secundario}</span>}
                    <span className="rounded bg-[#1A2E4F]/5 px-2 py-0.5 text-[11px] font-medium text-[#1A2E4F]/65">{p.formato_evento || nomeCategoriaPrincipal(p.categoria_principal)}</span>
                  </div>
                </div>
                {aCarregarId === p.id && (
                  <span className="absolute inset-0 flex items-center justify-center gap-2 bg-white/90 text-sm font-bold text-[#1A2E4F] backdrop-blur-[1px]">
                    <span className="size-4 animate-spin rounded-full border-2 border-[#EC2456]/25 border-t-[#EC2456]" />
                    A carregar informação…
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function FiltrosMapa({ filtro, onChange }: { filtro: FiltroMapa; onChange: (filtro: FiltroMapa) => void }) {
  const opcoes: { id: FiltroMapa; texto: string; cor: string }[] = [
    { id: "todas", texto: "Todas", cor: "#1A2E4F" },
    { id: "a_decorrer", texto: "A decorrer", cor: "#EC2456" },
    { id: "em_breve", texto: "7 dias", cor: "#F97B16" },
    { id: "futuro", texto: "Mais tarde", cor: "#8B93A7" },
  ];

  return (
    <div className="absolute inset-x-3 top-3 z-[5] flex justify-between rounded-lg bg-white/95 p-1 shadow-md ring-1 ring-[#1A2E4F]/10 backdrop-blur sm:inset-x-auto sm:right-4 sm:top-4" aria-label="Filtrar festas no mapa">
      {opcoes.map((opcao) => (
        <button key={opcao.id} type="button" onClick={() => onChange(opcao.id)} aria-pressed={filtro === opcao.id} className={`inline-flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-2 text-[11px] font-bold transition ${filtro === opcao.id ? "bg-[#1A2E4F]/[0.06] text-[#102745]" : "text-[#1A2E4F]/55 hover:text-[#102745]"}`}>
          <span className="size-1.5 rounded-full" style={{ backgroundColor: opcao.cor }} />
          {opcao.texto}
        </button>
      ))}
    </div>
  );
}

export default function MapaFestas({ dados }: { dados: FestasGeoJSON }) {
  const [painel, setPainel] = useState<Painel>({ modo: "fechado" });
  const [filtroMapa, setFiltroMapa] = useState<FiltroMapa>("todas");
  const [festaNoUrl, setFestaNoUrl] = useState<string | null>(null);
  const [erroMapa, setErroMapa] = useState(false);
  const [mapaPronto, setMapaPronto] = useState(false);
  const [lista, setLista] = useState<FestaSelecionada[]>([]);
  const [tituloLista, setTituloLista] = useState<string | undefined>();
  const [aFechar, setAFechar] = useState(false);
  const [aCarregarDetalhe, setACarregarDetalhe] = useState<string | null>(null);
  const [minhaLoc, setMinhaLoc] = useState<Coords | null>(null);
  const [nivelSheet, setNivelSheet] = useState<NivelSheet>("medio");
  const pediuLoc = useRef(false);
  const arrastoSheet = useRef<{ y: number; nivel: NivelSheet; moveu: boolean } | null>(null);
  const ignorarCliqueSheet = useRef(false);
  const mapaRef = useRef<FestaMapHandle>(null);
  const pedidoDetalheRef = useRef(0);
  const detalhesEmCache = useRef(new Map<string, DetalheEmCache>());
  const detalheUrlProcessadoRef = useRef<string | null | undefined>(undefined);

  const mostrarSublocalizacoesNoMapa = useCallback((locais: { lng: number; lat: number; nome: string; tipo: string }[]) => {
    if (mapaPronto) mapaRef.current?.mostrarSublocalizacoes(locais);
  }, [mapaPronto]);

  const dadosVisiveis = useMemo(() => filtroMapa === "todas"
    ? dados
    : { ...dados, features: dados.features.filter((festa) => festa.properties.estado_temporal === filtroMapa || (painel.modo === "detalhe" && festa.properties.id === painel.festa.props.id)) }, [dados, filtroMapa, painel]);

  const sincronizarUrl = useCallback((idFesta: string | null, filtro: FiltroMapa, historico: "push" | "replace") => {
    const url = new URL(window.location.href);
    if (idFesta) url.searchParams.set("festa", idFesta);
    else url.searchParams.delete("festa");
    if (filtro === "todas") url.searchParams.delete("estado");
    else url.searchParams.set("estado", filtro);
    window.history[`${historico}State`](null, "", `${url.pathname}${url.search}${url.hash}`);
    setFestaNoUrl(idFesta);
  }, []);

  useEffect(() => {
    const lerUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const estado = params.get("estado");
      setFestaNoUrl(params.get("festa"));
      setFiltroMapa(estado === "a_decorrer" || estado === "em_breve" || estado === "futuro" ? estado : "todas");
    };
    lerUrl();
    window.addEventListener("popstate", lerUrl);
    return () => window.removeEventListener("popstate", lerUrl);
  }, []);

  const pedirLocalizacao = useCallback(() => {
    if (pediuLoc.current || !("geolocation" in navigator)) return;
    pediuLoc.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMinhaLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300_000 },
    );
  }, []);

  const abrirDetalhe = useCallback(async (festa: FestaSelecionada, deLista: boolean, atualizarHistorico = true) => {
    const pedido = pedidoDetalheRef.current + 1;
    pedidoDetalheRef.current = pedido;
    setACarregarDetalhe(festa.props.id);
    const chave = `${festa.props.concelho_slug}/${festa.props.slug}`;
    const emCache = detalhesEmCache.current.get(chave);
    let detalhe: DetalheExtra | null = emCache && emCache.expiraEm > Date.now() ? emCache.valor : null;
    if (!emCache || emCache.expiraEm <= Date.now()) {
      try {
        const resposta = await fetch(`/api/festa?concelho=${encodeURIComponent(festa.props.concelho_slug)}&slug=${encodeURIComponent(festa.props.slug)}`);
        detalhe = resposta.ok ? normalizarDetalhe(await resposta.json()) : null;
        if (resposta.ok) detalhesEmCache.current.set(chave, { valor: detalhe, expiraEm: Date.now() + DURACAO_CACHE_DETALHE });
      } catch {
        detalhe = null;
      }
    }

    if (pedido !== pedidoDetalheRef.current) return;
    setACarregarDetalhe(null);
    setAFechar(false);
    setNivelSheet("completo");
    setPainel({ modo: "detalhe", festa, deLista, detalhe });
    if (atualizarHistorico) sincronizarUrl(festa.props.id, filtroMapa, "push");
  }, [filtroMapa, sincronizarUrl]);

  useEffect(() => {
    if (painel.modo === "detalhe") mapaRef.current?.focarFesta(painel.festa.lngLat);
  }, [painel]);

  useEffect(() => {
    if (festaNoUrl === detalheUrlProcessadoRef.current) return;
    detalheUrlProcessadoRef.current = festaNoUrl;
    if (!festaNoUrl) {
      if (painel.modo !== "fechado" && !aFechar) {
        mapaRef.current?.reporVista();
        // Sincroniza o painel com o parâmetro externo da URL.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPainel({ modo: "fechado" });
      }
      return;
    }
    if (painel.modo === "detalhe" && painel.festa.props.id === festaNoUrl) return;
    const feature = dados.features.find((festa) => festa.properties.id === festaNoUrl);
    if (feature) void abrirDetalhe({ props: feature.properties, lngLat: feature.geometry.coordinates as [number, number] }, false, false);
  }, [aFechar, abrirDetalhe, dados.features, festaNoUrl, painel]);

  useEffect(() => {
    const pesquisar = (evento: Event) => {
      const termo = evento instanceof CustomEvent ? evento.detail : "";
      if (typeof termo !== "string" || !termo.trim()) return;
      const consulta = termo.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      const resultados = dados.features.flatMap((feature) => {
        const p = feature.properties;
        const texto = [p.nome, p.freguesia, p.concelho, p.distrito, nomeCategoriaPrincipal(p.categoria_principal), p.formato_evento, ...(p.tags_evento ?? []), ...(p.categorias ?? [])]
          .filter(Boolean)
          .join(" ")
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase();
        return texto.includes(consulta)
          ? [{ props: p, lngLat: feature.geometry.coordinates as [number, number] }]
          : [];
      });
      setLista(resultados);
      setTituloLista(resultados.length ? `${resultados.length} resultado${resultados.length === 1 ? "" : "s"}` : "Sem resultados");
      setAFechar(false);
      setNivelSheet("medio");
      setPainel({ modo: "lista", festas: resultados, titulo: resultados.length ? `${resultados.length} resultado${resultados.length === 1 ? "" : "s"}` : "Sem resultados" });
    };
    window.addEventListener("achafestas:pesquisa", pesquisar);
    return () => window.removeEventListener("achafestas:pesquisa", pesquisar);
  }, [dados]);

  useEffect(() => {
    const abrirDaPesquisa = (evento: Event) => {
      const id = evento instanceof CustomEvent ? evento.detail : "";
      if (typeof id !== "string") return;
      const feature = dados.features.find((festa) => festa.properties.id === id);
      if (!feature) return;
      setTituloLista(undefined);
      setAFechar(false);
      void abrirDetalhe({ props: feature.properties, lngLat: feature.geometry.coordinates as [number, number] }, false);
    };
    window.addEventListener("achafestas:abrir-festa", abrirDaPesquisa);
    return () => window.removeEventListener("achafestas:abrir-festa", abrirDaPesquisa);
  }, [dados, abrirDetalhe]);

  const fechar = useCallback(() => {
    setAFechar(true);
    mapaRef.current?.reporVista();
    sincronizarUrl(null, filtroMapa, "replace");
    setTimeout(() => {
      setPainel({ modo: "fechado" });
      setAFechar(false);
    }, 200);
  }, [filtroMapa, sincronizarUrl]);

  useEffect(() => {
    if (painel.modo === "fechado") return;
    const aoTeclado = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") fechar();
    };
    window.addEventListener("keydown", aoTeclado);
    return () => window.removeEventListener("keydown", aoTeclado);
  }, [fechar, painel.modo]);

  function abrir(novo: Painel) {
    setAFechar(false);
    setNivelSheet(novo.modo === "detalhe" ? "completo" : "medio");
    setPainel(novo);
  }

  const iniciarArrastoSheet = (evento: ReactPointerEvent<HTMLButtonElement>) => {
    evento.currentTarget.setPointerCapture(evento.pointerId);
    arrastoSheet.current = { y: evento.clientY, nivel: nivelSheet, moveu: false };
  };

  const moverSheet = (evento: ReactPointerEvent<HTMLButtonElement>) => {
    if (!arrastoSheet.current || Math.abs(evento.clientY - arrastoSheet.current.y) < 8) return;
    arrastoSheet.current.moveu = true;
  };

  const terminarArrastoSheet = (evento: ReactPointerEvent<HTMLButtonElement>) => {
    const inicio = arrastoSheet.current;
    arrastoSheet.current = null;
    if (!inicio) return;
    ignorarCliqueSheet.current = inicio.moveu;
    const indice = ORDEM_SHEET.indexOf(inicio.nivel);
    const delta = evento.clientY - inicio.y;
    if (delta > 45) setNivelSheet(ORDEM_SHEET[Math.max(0, indice - 1)]);
    else if (delta < -45) setNivelSheet(ORDEM_SHEET[Math.min(ORDEM_SHEET.length - 1, indice + 1)]);
  };

  const alternarNivelSheet = () => {
    if (ignorarCliqueSheet.current) { ignorarCliqueSheet.current = false; return; }
    const indice = ORDEM_SHEET.indexOf(nivelSheet);
    setNivelSheet(ORDEM_SHEET[(indice + 1) % ORDEM_SHEET.length]);
  };

  const alterarFiltroMapa = (proximoFiltro: FiltroMapa) => {
    setFiltroMapa(proximoFiltro);
    sincronizarUrl(painel.modo === "detalhe" ? painel.festa.props.id : null, proximoFiltro, "replace");
  };

  const chaveConteudo =
    painel.modo === "detalhe" ? `detalhe-${painel.festa.props.id}` : painel.modo;

  return (
    <>
      <FestaMap
        ref={mapaRef}
        dados={dadosVisiveis}
        festaSelecionadaId={painel.modo === "detalhe" ? painel.festa.props.id : null}
        aoCarregar={() => { setErroMapa(false); setMapaPronto(true); }}
        aoErro={() => { setErroMapa(true); setMapaPronto(false); }}
        aoEscolherFesta={(festa) => void abrirDetalhe(festa, false)}
        aoEscolherGrupo={(festas) => {
          setLista(festas);
          setTituloLista(undefined);
          abrir({ modo: "lista", festas });
        }}
      />
      {painel.modo !== "detalhe" && <FiltrosMapa filtro={filtroMapa} onChange={alterarFiltroMapa} />}
      {painel.modo === "fechado" && <ConviteOrganizador />}
      {erroMapa && <div role="status" className="absolute inset-x-4 top-4 z-20 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-lg bg-white px-3 py-2.5 text-xs font-semibold text-[#1A2E4F] shadow-lg ring-1 ring-[#1A2E4F]/10"><span>Não foi possível carregar o mapa.</span><button type="button" onClick={() => window.location.reload()} className="cursor-pointer text-[#EC2456] transition hover:text-[#d11a47]">Tentar de novo</button></div>}

      {painel.modo !== "fechado" && (
        <div
          className={`painel-sheet painel-entrada absolute inset-x-0 bottom-0 z-10 overflow-hidden rounded-t-xl bg-white shadow-2xl ring-1 ring-[#1A2E4F]/10 sm:inset-x-auto sm:bottom-4 sm:left-4 sm:top-4 sm:h-auto sm:w-[430px] sm:rounded-lg ${aFechar ? "painel-saida" : ""}`}
          style={{ "--sheet-altura": ALTURA_SHEET[nivelSheet] } as CSSProperties}
        >
          <button type="button" onPointerDown={iniciarArrastoSheet} onPointerMove={moverSheet} onPointerUp={terminarArrastoSheet} onPointerCancel={() => { arrastoSheet.current = null; }} onClick={alternarNivelSheet} aria-label={`Painel ${nivelSheet}. Arrasta para redimensionar`} className="absolute left-1/2 top-1.5 z-30 flex h-4 w-12 -translate-x-1/2 touch-none items-center justify-center rounded-full bg-white/80 shadow-sm backdrop-blur sm:hidden"><span className="h-1 w-7 rounded-full bg-[#1A2E4F]/30" /></button>
          <div key={chaveConteudo} className="conteudo-entrada h-full">
            {painel.modo === "detalhe" ? (
              <DetalheFesta
                festa={painel.festa}
                detalhe={painel.detalhe}
                deLista={painel.deLista}
                minhaLoc={minhaLoc}
                pedirLocalizacao={pedirLocalizacao}
                aoVoltar={() => {
                  mapaRef.current?.afastarFesta(painel.festa.lngLat);
                  abrir({ modo: "lista", festas: lista, titulo: tituloLista });
                }}
                aoFechar={fechar}
                aoFocarSublocalizacao={(local) => mapaRef.current?.focarSublocalizacao(local)}
                aoMostrarSublocalizacoes={mostrarSublocalizacoesNoMapa}
              />
            ) : (
              <ListaFestas
                festas={painel.festas}
                minhaLoc={minhaLoc}
                titulo={painel.titulo}
                aoEscolher={(festa) => {
                  void abrirDetalhe(festa, true);
                }}
                aoFechar={fechar}
                aCarregarId={aCarregarDetalhe ?? undefined}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
