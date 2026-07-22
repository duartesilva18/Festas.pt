"use client";

import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useId, useRef, useState } from "react";
import type { SublocalizacaoRascunho } from "@/lib/criar-evento";
import { criarElementoSublocalizacao, pinFestaSVG, svgDataUrl } from "@/lib/mapa-pins";

type Props = {
  principal: { lat: number | null; lng: number | null };
  sublocalizacoes: SublocalizacaoRascunho[];
  alvo: "principal" | string;
  onEscolher: (lat: number, lng: number) => void;
};

type ResultadoLocalidade = {
  id: string;
  nome: string;
  descricao: string;
  tipo: string;
  lat: number;
  lng: number;
  limites: [number, number, number, number] | null;
};

function elementoFestaPrincipal(ativo: boolean) {
  const elemento = document.createElement("img");
  elemento.src = svgDataUrl(pinFestaSVG("#EC2456"));
  elemento.alt = "";
  elemento.setAttribute("aria-hidden", "true");
  elemento.style.cssText = `width:${ativo ? 46 : 40}px;height:auto;filter:${ativo ? "drop-shadow(0 0 0.35rem #ec24564d)" : "none"};transition:width .16s ease`;
  return elemento;
}

export default function EditorMapaEvento({ principal, sublocalizacoes, alvo, onEscolher }: Props) {
  const recipienteRef = useRef<HTMLDivElement>(null);
  const mapaRef = useRef<maplibregl.Map | null>(null);
  const marcadoresRef = useRef<maplibregl.Marker[]>([]);
  const onEscolherRef = useRef(onEscolher);
  const ignorarPesquisaRef = useRef(false);
  const numeroPedidoRef = useRef(0);
  const idPesquisa = useId();
  const idResultados = `${idPesquisa}-resultados`;
  const [pesquisa, setPesquisa] = useState("");
  const [resultados, setResultados] = useState<ResultadoLocalidade[]>([]);
  const [listaAberta, setListaAberta] = useState(false);
  const [aPesquisar, setAPesquisar] = useState(false);
  const [erroPesquisa, setErroPesquisa] = useState<string | null>(null);
  const [localidadeEscolhida, setLocalidadeEscolhida] = useState<string | null>(null);
  const [indiceAtivo, setIndiceAtivo] = useState(0);

  useEffect(() => { onEscolherRef.current = onEscolher; }, [onEscolher]);

  useEffect(() => {
    if (!recipienteRef.current || mapaRef.current) return;
    const mapa = new maplibregl.Map({
      container: recipienteRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [-8.22, 39.65],
      zoom: 5.7,
      attributionControl: false,
    });
    mapa.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    mapa.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    mapa.on("click", (evento) => onEscolherRef.current(Number(evento.lngLat.lat.toFixed(6)), Number(evento.lngLat.lng.toFixed(6))));
    mapaRef.current = mapa;
    return () => { mapa.remove(); mapaRef.current = null; };
  }, []);

  useEffect(() => {
    const mapa = mapaRef.current;
    if (!mapa) return;
    marcadoresRef.current.forEach((marcador) => marcador.remove());
    const marcadores: maplibregl.Marker[] = [];

    if (principal.lat != null && principal.lng != null) {
      marcadores.push(new maplibregl.Marker({ element: elementoFestaPrincipal(alvo === "principal"), anchor: "bottom" })
        .setLngLat([principal.lng, principal.lat]).addTo(mapa));
    }

    for (const local of sublocalizacoes) {
      if (local.lat == null || local.lng == null) continue;
      const elemento = criarElementoSublocalizacao(local.tipo, local.nome || "Ponto no recinto", { ativo: alvo === local.id, interativo: false });
      marcadores.push(new maplibregl.Marker({ element: elemento, anchor: "bottom" })
        .setLngLat([local.lng, local.lat]).addTo(mapa));
    }
    marcadoresRef.current = marcadores;

    const selecionado = alvo === "principal" ? principal : sublocalizacoes.find((local) => local.id === alvo);
    if (selecionado?.lat != null && selecionado.lng != null) {
      mapa.easeTo({ center: [selecionado.lng, selecionado.lat], zoom: Math.max(mapa.getZoom(), 15), duration: 500 });
    }
  }, [alvo, principal, sublocalizacoes]);

  useEffect(() => {
    if (ignorarPesquisaRef.current) {
      ignorarPesquisaRef.current = false;
      return;
    }
    const consulta = pesquisa.trim();
    if (consulta.length < 2) return;
    const controlador = new AbortController();
    const numeroPedido = numeroPedidoRef.current + 1;
    numeroPedidoRef.current = numeroPedido;
    const temporizador = window.setTimeout(async () => {
      try {
        const resposta = await fetch(`/api/localizacoes/pesquisar?q=${encodeURIComponent(consulta)}`, {
          signal: controlador.signal,
        });
        const dados = await resposta.json().catch(() => ({})) as { resultados?: unknown; error?: unknown };
        if (controlador.signal.aborted || numeroPedido !== numeroPedidoRef.current) return;
        if (!resposta.ok) throw new Error(typeof dados.error === "string" ? dados.error : "Não foi possível pesquisar.");
        const lista = Array.isArray(dados.resultados)
          ? dados.resultados.filter((item): item is ResultadoLocalidade => {
            if (!item || typeof item !== "object") return false;
            const candidato = item as Partial<ResultadoLocalidade>;
            const limitesValidos = candidato.limites === null || (
              Array.isArray(candidato.limites) && candidato.limites.length === 4 && candidato.limites.every(Number.isFinite)
            );
            return typeof candidato.id === "string" && typeof candidato.nome === "string" && typeof candidato.descricao === "string" && typeof candidato.tipo === "string" && Number.isFinite(candidato.lat) && Number.isFinite(candidato.lng) && limitesValidos;
          }).slice(0, 6)
          : [];
        setResultados(lista);
        setIndiceAtivo(0);
        setErroPesquisa(null);
        setListaAberta(true);
      } catch (erro) {
        if (controlador.signal.aborted || numeroPedido !== numeroPedidoRef.current) return;
        setResultados([]);
        setErroPesquisa(erro instanceof Error ? erro.message : "Não foi possível pesquisar.");
        setListaAberta(true);
      } finally {
        if (!controlador.signal.aborted && numeroPedido === numeroPedidoRef.current) setAPesquisar(false);
      }
    }, 450);
    return () => {
      window.clearTimeout(temporizador);
      controlador.abort();
    };
  }, [pesquisa]);

  function alterarPesquisa(valor: string) {
    const pesquisar = valor.trim().length >= 2;
    setPesquisa(valor);
    setResultados([]);
    setIndiceAtivo(0);
    setErroPesquisa(null);
    setLocalidadeEscolhida(null);
    setListaAberta(pesquisar);
    setAPesquisar(pesquisar);
  }

  function escolherLocalidade(resultado: ResultadoLocalidade) {
    ignorarPesquisaRef.current = true;
    numeroPedidoRef.current += 1;
    setPesquisa(resultado.nome);
    setListaAberta(false);
    setAPesquisar(false);
    setErroPesquisa(null);
    setLocalidadeEscolhida(resultado.nome);
    const mapa = mapaRef.current;
    if (!mapa) return;
    mapa.stop();
    const limites = resultado.limites;
    if (limites) {
      const [sul, norte, oeste, este] = limites;
      mapa.fitBounds([[oeste, sul], [este, norte]], { padding: 64, maxZoom: 14.5, duration: 700, essential: true });
    } else {
      mapa.easeTo({ center: [resultado.lng, resultado.lat], zoom: 13.5, duration: 700, essential: true });
    }
  }

  function aoTeclado(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === "Escape") {
      setListaAberta(false);
      return;
    }
    if (!listaAberta || resultados.length === 0) return;
    if (evento.key === "ArrowDown") {
      evento.preventDefault();
      setIndiceAtivo((atual) => Math.min(resultados.length - 1, atual + 1));
    } else if (evento.key === "ArrowUp") {
      evento.preventDefault();
      setIndiceAtivo((atual) => Math.max(0, atual - 1));
    } else if (evento.key === "Enter") {
      evento.preventDefault();
      escolherLocalidade(resultados[indiceAtivo]);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-xl border border-[#1A2E4F]/12 bg-[#EAF0F8]">
      <div className="border-b border-[#1A2E4F]/10 bg-white p-3">
        <div
          className="relative max-w-md"
          onBlur={(evento) => { if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setListaAberta(false); }}
        >
          <label htmlFor={idPesquisa} className="sr-only">Procurar cidade, vila ou localidade</label>
          <div className={`flex h-11 items-center gap-2.5 rounded-lg border bg-white px-3 transition ${listaAberta ? "border-[#EC2456]/45 shadow-[0_0_0_3px_rgba(236,36,86,.07)]" : "border-[#1A2E4F]/15 hover:border-[#1A2E4F]/25"}`}>
            <svg aria-hidden="true" className="size-4 shrink-0 text-[#1A2E4F]/45" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
            <input
              id={idPesquisa}
              role="combobox"
              aria-autocomplete="list"
              aria-controls={idResultados}
              aria-expanded={listaAberta}
              aria-activedescendant={listaAberta && resultados[indiceAtivo] ? `${idResultados}-${resultados[indiceAtivo].id}` : undefined}
              value={pesquisa}
              onChange={(evento) => alterarPesquisa(evento.target.value)}
              onFocus={() => { if (pesquisa.trim().length >= 2) setListaAberta(true); }}
              onKeyDown={aoTeclado}
              autoComplete="off"
              maxLength={80}
              placeholder="Procurar uma cidade ou localidade…"
              className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#102745] outline-none placeholder:text-[#1A2E4F]/40"
            />
            {aPesquisar && <span aria-label="A pesquisar" className="size-4 animate-spin rounded-full border-2 border-[#1A2E4F]/15 border-t-[#EC2456]" />}
            {!aPesquisar && pesquisa && <button type="button" aria-label="Limpar pesquisa" onClick={() => alterarPesquisa("")} className="flex size-7 cursor-pointer items-center justify-center rounded-md text-[#1A2E4F]/40 transition hover:bg-[#1A2E4F]/5 hover:text-[#102745]">×</button>}
          </div>

          {listaAberta && (
            <div id={idResultados} role="listbox" className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-lg border border-[#1A2E4F]/10 bg-white py-1 shadow-xl">
              {aPesquisar && resultados.length === 0 && <p className="px-3 py-3 text-xs text-[#1A2E4F]/55">A procurar localidades…</p>}
              {!aPesquisar && erroPesquisa && <p role="status" className="px-3 py-3 text-xs font-medium text-[#C43D4B]">{erroPesquisa}</p>}
              {!aPesquisar && !erroPesquisa && resultados.length === 0 && <p className="px-3 py-3 text-xs text-[#1A2E4F]/55">Nenhuma localidade portuguesa encontrada.</p>}
              {resultados.map((resultado, indice) => (
                <button
                  key={resultado.id}
                  id={`${idResultados}-${resultado.id}`}
                  type="button"
                  role="option"
                  aria-selected={indice === indiceAtivo}
                  onMouseEnter={() => setIndiceAtivo(indice)}
                  onMouseDown={(evento) => evento.preventDefault()}
                  onClick={() => escolherLocalidade(resultado)}
                  className={`flex w-full cursor-pointer items-start gap-3 px-3 py-2.5 text-left transition ${indice === indiceAtivo ? "bg-[#EC2456]/[0.055]" : "hover:bg-[#1A2E4F]/[0.035]"}`}
                >
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#EC2456]/8 text-[#EC2456]"><svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 21s-7-6.3-7-11a7 7 0 1 1 14 0c0 4.7-7 11-7 11z" /><circle cx="12" cy="10" r="2" /></svg></span>
                  <span className="min-w-0"><span className="flex items-center gap-2"><strong className="truncate text-sm text-[#102745]">{resultado.nome}</strong><span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-[#1A2E4F]/35">{resultado.tipo}</span></span><span className="mt-0.5 block truncate text-xs text-[#1A2E4F]/50">{resultado.descricao}</span></span>
                </button>
              ))}
              <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="block border-t border-[#1A2E4F]/8 px-3 py-2 text-[10px] text-[#1A2E4F]/40 transition hover:text-[#1A2E4F]/65">Resultados © OpenStreetMap</a>
            </div>
          )}
        </div>
        <p className={`mt-2 text-[11px] ${localidadeEscolhida ? "font-semibold text-[#20856D]" : "text-[#1A2E4F]/45"}`}>
          {localidadeEscolhida ? `Mapa centrado em ${localidadeEscolhida}. Agora clica no mapa para marcar o ponto.` : "Pesquisa uma zona para te orientares; a localização só é guardada quando clicares no mapa."}
        </p>
      </div>
      <div className="relative">
        <div ref={recipienteRef} className="h-[360px] w-full sm:h-[430px]" />
        <p className="pointer-events-none absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-2 text-xs font-semibold text-[#102745] shadow-sm">
          Clica no mapa para posicionar {alvo === "principal" ? "a festa" : "este ponto"}
        </p>
      </div>
    </div>
  );
}
