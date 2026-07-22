"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FestasGeoJSON, FestaFeature } from "@/lib/eventos";
import { CORES, type FestaSelecionada } from "@/lib/festa-ui";
import {
  criarElementoSublocalizacao,
  PIN_RECINTO,
  pinFestaSVG,
  pinGrupoSVG,
  tipoSublocalizacao,
} from "@/lib/mapa-pins";
import mascaraPortugal from "@/data/mascara-portugal.json";

const PORTUGAL_BOUNDS: [[number, number], [number, number]] = [
  [-9.75, 36.8],
  [-6.1, 42.25],
];

// O centro da camara fica sempre sobre Portugal: ve-se Espanha nas margens,
// mas nao e possivel navegar para la.
const CENTRO_LIMITES = { lngMin: -9.4, lngMax: -6.7, latMin: 37.0, latMax: 42.0 };

// A máscara tem um rectângulo exterior e Portugal como recorte: é a forma mais
// fiável de sombrear toda a Espanha sem depender de uma costa simplificada.
const geometriaMascara = mascaraPortugal.features[0]?.geometry as GeoJSON.Polygon | undefined;
const fronteiraPortugal = geometriaMascara?.coordinates[1] ?? [];

function paddingPainel(): maplibregl.PaddingOptions {
  if (window.matchMedia("(max-width: 639px)").matches) {
    return {
      bottom: Math.min(window.innerHeight - 150, Math.round(window.innerHeight * 0.7)),
      left: 32,
      right: 32,
      top: 28,
    };
  }
  return { left: 450, top: 24, right: 24, bottom: 24 };
}

function vigiarCentro(map: maplibregl.Map) {
  let aRepor = false;
  map.on("moveend", () => {
    if (aRepor) {
      aRepor = false;
      return;
    }
    const c = map.getCenter();
    const lng = Math.min(Math.max(c.lng, CENTRO_LIMITES.lngMin), CENTRO_LIMITES.lngMax);
    const lat = Math.min(Math.max(c.lat, CENTRO_LIMITES.latMin), CENTRO_LIMITES.latMax);
    if (lng !== c.lng || lat !== c.lat) {
      aRepor = true;
      map.easeTo({ center: [lng, lat], duration: 350 });
    }
  });
}

function mostrarPinosFesta(map: maplibregl.Map, mostrar: boolean) {
  if (map.getLayer("festas-pontos")) {
    map.setLayoutProperty("festas-pontos", "visibility", mostrar ? "visible" : "none");
  }
}

function carregarSVG(map: maplibregl.Map, id: string, svg: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 4 });
      resolve();
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

function carregarPin(map: maplibregl.Map, id: string, cor: string): Promise<void> {
  return carregarSVG(map, id, pinFestaSVG(cor));
}

function carregarImagem(map: maplibregl.Map, id: string, origem: string, largura = 256, altura = 256): Promise<void> {
  return new Promise((resolve, reject) => {
    const imagem = new window.Image(largura, altura);
    imagem.onload = () => {
      if (!map.hasImage(id)) map.addImage(id, imagem, { pixelRatio: 4 });
      resolve();
    };
    imagem.onerror = () => reject(new Error(`Não foi possível carregar ${origem}`));
    imagem.src = origem;
  });
}

async function obterPinsPersonalizados(): Promise<Record<string, string>> {
  try {
    const resposta = await fetch("/api/mapa/pins", { cache: "no-store" });
    if (!resposta.ok) return {};
    const dados = await resposta.json() as { pins?: { tipo: string; imagem_url: string }[] };
    return Object.fromEntries((dados.pins ?? []).filter((pin) => typeof pin.tipo === "string" && typeof pin.imagem_url === "string").map((pin) => [pin.tipo, pin.imagem_url]));
  } catch {
    return {};
  }
}

function paraSelecao(f: GeoJSON.Feature): FestaSelecionada {
  const props = { ...f.properties } as FestaFeature["properties"];
  // MapLibre serializa arrays/objetos das propriedades em string JSON.
  if (typeof props.categorias === "string") {
    try {
      props.categorias = JSON.parse(props.categorias);
    } catch {
      props.categorias = [];
    }
  }
  if (!Array.isArray(props.categorias)) props.categorias = [];
  if (typeof props.tags_evento === "string") {
    try {
      props.tags_evento = JSON.parse(props.tags_evento);
    } catch {
      props.tags_evento = [];
    }
  }
  if (!Array.isArray(props.tags_evento)) props.tags_evento = [];
  return {
    props,
    lngLat: (f.geometry as GeoJSON.Point).coordinates as [number, number],
  };
}

type Props = {
  dados: FestasGeoJSON;
  aoEscolherFesta?: (sel: FestaSelecionada) => void;
  aoEscolherGrupo?: (sels: FestaSelecionada[]) => void;
  festaSelecionadaId?: string | null;
  aoCarregar?: () => void;
  aoErro?: () => void;
};

export type FestaMapHandle = {
  reporVista: () => void;
  focarFesta: (lngLat: [number, number]) => void;
  afastarFesta: (lngLat: [number, number]) => void;
  focarSublocalizacao: (local: { lng: number; lat: number; nome: string }) => void;
  mostrarSublocalizacoes: (locais: { lng: number; lat: number; nome: string; tipo: string }[]) => void;
};

const TIPO_ADMIN_RECINTO: Record<string, string> = {
  estacionamento: "estacionamento",
  entrada: "entrada_principal",
  wc: "casas_banho",
  palco: "palco_after",
  after: "palco_after",
};

function criarPinRecinto(tipo: string, nome: string, imagem?: string) {
  const elemento = criarElementoSublocalizacao(tipo, nome);
  if (imagem) {
    elemento.replaceChildren();
    const figura = document.createElement("img");
    figura.src = imagem;
    figura.alt = "";
    figura.className = "mapa-sublocalizacao-imagem";
    elemento.append(figura);
  }
  return elemento;
}

function popupSublocalizacao(local: { nome: string; tipo: string; lat: number; lng: number }) {
  const conteudo = document.createElement("div");
  conteudo.className = "mapa-popup-recinto";
  const tipo = document.createElement("span");
  tipo.className = "mapa-popup-tipo";
  tipo.textContent = PIN_RECINTO[tipoSublocalizacao(local.tipo)].descricao;
  const titulo = document.createElement("strong");
  titulo.className = "mapa-popup-titulo";
  titulo.textContent = local.nome;
  const ligacao = document.createElement("a");
  ligacao.href = `https://www.google.com/maps/dir/?api=1&destination=${local.lat},${local.lng}`;
  ligacao.target = "_blank";
  ligacao.rel = "noopener noreferrer";
  ligacao.textContent = "Abrir localização  →";
  ligacao.className = "mapa-popup-localizacao";
  conteudo.append(tipo, titulo, ligacao);
  return conteudo;
}

const FestaMap = forwardRef<FestaMapHandle, Props>(function FestaMap(
  { dados, aoEscolherFesta, aoEscolherGrupo, festaSelecionadaId, aoCarregar, aoErro },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marcadoresSublocalizacaoRef = useRef<maplibregl.Marker[]>([]);
  const sublocalizacoesPendentesRef = useRef<{ lng: number; lat: number; nome: string; tipo: string }[]>([]);
  const mapaProntoRef = useRef(false);
  const pinsPersonalizadosRef = useRef<Record<string, string>>({});
  const dadosRef = useRef(dados);
  const escolherFestaRef = useRef(aoEscolherFesta);
  const escolherGrupoRef = useRef(aoEscolherGrupo);
  const aoCarregarRef = useRef(aoCarregar);
  const aoErroRef = useRef(aoErro);
  const festaSelecionadaIdRef = useRef(festaSelecionadaId);
  dadosRef.current = dados;
  escolherFestaRef.current = aoEscolherFesta;
  escolherGrupoRef.current = aoEscolherGrupo;
  aoCarregarRef.current = aoCarregar;
  aoErroRef.current = aoErro;
  festaSelecionadaIdRef.current = festaSelecionadaId;

  function aplicarSublocalizacoes(
    map: maplibregl.Map,
    locais: { lng: number; lat: number; nome: string; tipo: string }[],
  ) {
    marcadoresSublocalizacaoRef.current.forEach((marcador) => marcador.remove());
    mostrarPinosFesta(map, locais.length === 0);
    marcadoresSublocalizacaoRef.current = locais.map((local) => {
      const elemento = criarPinRecinto(local.tipo, local.nome, pinsPersonalizadosRef.current[TIPO_ADMIN_RECINTO[local.tipo]]);
      elemento.addEventListener("click", () => {
        map.easeTo({
          center: [local.lng, local.lat],
          zoom: Math.max(map.getZoom(), 17),
          padding: paddingPainel(),
          duration: 550,
          essential: true,
        });
      });
      return new maplibregl.Marker({ element: elemento, anchor: "bottom" })
        .setLngLat([local.lng, local.lat])
        .setPopup(new maplibregl.Popup({ offset: 26, focusAfterOpen: false }).setDOMContent(popupSublocalizacao(local)))
        .addTo(map);
    });
    if (locais.length > 0) {
      const limites = locais.reduce(
        (bounds, local) => bounds.extend([local.lng, local.lat]),
        new maplibregl.LngLatBounds(),
      );
      map.fitBounds(limites, {
        padding: paddingPainel(),
        maxZoom: 17.5,
        duration: 650,
        essential: true,
      });
    }
  }

  useImperativeHandle(ref, () => ({
    reporVista() {
      sublocalizacoesPendentesRef.current = [];
      marcadoresSublocalizacaoRef.current.forEach((marcador) => marcador.remove());
      marcadoresSublocalizacaoRef.current = [];
      const map = mapRef.current;
      if (!map) return;
      mostrarPinosFesta(map, true);
      map.fitBounds(PORTUGAL_BOUNDS, {
        padding: 24,
        duration: 900,
        essential: true,
      });
    },
    focarFesta(lngLat) {
      const map = mapRef.current;
      if (!map) return;
      map.stop();
      mostrarPinosFesta(map, true);
      map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 15), padding: paddingPainel(), duration: 700, essential: true });
    },
    afastarFesta(lngLat) {
      const map = mapRef.current;
      if (!map) return;
      sublocalizacoesPendentesRef.current = [];
      marcadoresSublocalizacaoRef.current.forEach((marcador) => marcador.remove());
      marcadoresSublocalizacaoRef.current = [];
      mostrarPinosFesta(map, true);
      map.easeTo({ center: lngLat, zoom: 12, padding: paddingPainel(), duration: 650, essential: true });
    },
    focarSublocalizacao(local) {
      const map = mapRef.current;
      if (!map) return;
      const marcador = marcadoresSublocalizacaoRef.current.find((item) => item.getLngLat().lng === local.lng && item.getLngLat().lat === local.lat);
      marcador?.togglePopup();
      map.easeTo({ center: [local.lng, local.lat], zoom: Math.max(map.getZoom(), 16), padding: paddingPainel(), duration: 600 });
    },
    mostrarSublocalizacoes(locais) {
      sublocalizacoesPendentesRef.current = locais;
      const map = mapRef.current;
      if (!map || !mapaProntoRef.current) return;
      aplicarSublocalizacoes(map, locais);
    },
  }));

  useEffect(() => {
    const map = mapRef.current;
    const source = map?.getSource("festas") as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(dados);
  }, [dados]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("festas-pontos")) return;
    map.setPaintProperty("festas-pontos", "icon-opacity", festaSelecionadaId
      ? ["case", ["==", ["get", "id"], festaSelecionadaId], 1, 0.42]
      : 1,
    );
  }, [festaSelecionadaId]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      bounds: PORTUGAL_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      maxBounds: [
        [-16.5, 35.6],
        [1.0, 43.5],
      ],
      minZoom: 5,
      attributionControl: false,
    });
    mapRef.current = map;

    map.once("error", () => aoErroRef.current?.());

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    vigiarCentro(map);
    map.once("idle", () => {
      containerRef.current
        ?.querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show");
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", async () => {
      // O estilo base traz nomes internacionais ("Lisbon"); força português
      // com fallback para o nome local em todas as camadas de texto.
      for (const camada of map.getStyle().layers ?? []) {
        if (camada.type !== "symbol") continue;
        const campo = map.getLayoutProperty(camada.id, "text-field");
        if (campo && JSON.stringify(campo).includes("name")) {
          map.setLayoutProperty(camada.id, "text-field", [
            "coalesce",
            ["get", "name:pt"],
            ["get", "name"],
          ]);
        }
      }

      const pinsPersonalizados = await obterPinsPersonalizados();
      pinsPersonalizadosRef.current = pinsPersonalizados;
      const carregarPinConfiguravel = (id: string, tipo: string, cor: string) => pinsPersonalizados[tipo]
        ? carregarImagem(map, id, pinsPersonalizados[tipo], 256, 288).catch(() => carregarPin(map, id, cor))
        : carregarPin(map, id, cor);
      await Promise.all([
        carregarPinConfiguravel("pin-a-decorrer", "festa_a_decorrer", CORES.a_decorrer),
        carregarPinConfiguravel("pin-em-breve", "festa_em_breve", CORES.em_breve),
        carregarPinConfiguravel("pin-futuro", "festa_mais_tarde", CORES.futuro),
        pinsPersonalizados.grupo_festas
          ? carregarImagem(map, "pin-grupo-festas", pinsPersonalizados.grupo_festas)
            .catch(() => carregarSVG(map, "pin-grupo-festas", pinGrupoSVG()))
          : carregarSVG(map, "pin-grupo-festas", pinGrupoSVG()),
      ]);

      // A máscara cobre tudo fora de Portugal. A camada de água real, colocada
      // logo por cima, devolve o Atlântico e os rios à sua cor normal.
      map.addSource("sombra-espanha", { type: "geojson", data: mascaraPortugal as GeoJSON.FeatureCollection });
      map.addLayer({
          id: "sombra-espanha",
          type: "fill",
          source: "sombra-espanha",
          paint: { "fill-color": "#C9DDF6", "fill-opacity": 0.58 },
        });
      map.addLayer({
        id: "agua-sobre-sombra",
        type: "fill",
        source: "openmaptiles",
        "source-layer": "water",
        filter: ["!=", ["get", "brunnel"], "tunnel"],
        paint: { "fill-color": "rgb(158,189,255)" },
      });

      if (fronteiraPortugal.length > 0) {
        map.addSource("fronteira-portugal", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [fronteiraPortugal] } },
        });
        map.addLayer({
          id: "fronteira-portugal",
          type: "line",
          source: "fronteira-portugal",
          paint: { "line-color": "#EC2456", "line-width": 1.25, "line-opacity": 0.58 },
        });
      }

      map.addSource("festas", {
        type: "geojson",
        data: dadosRef.current,
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 46,
      });

      map.addLayer({
        id: "clusters",
        type: "symbol",
        source: "festas",
        filter: ["has", "point_count"],
        layout: {
          "icon-image": "pin-grupo-festas",
          "icon-anchor": "center",
          "icon-size": ["step", ["get", "point_count"], 0.56, 10, 0.64, 30, 0.72],
          "icon-allow-overlap": true,
        },
      });

      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "festas",
        filter: ["has", "point_count"],
        layout: {
          "text-field": ["get", "point_count_abbreviated"],
          "text-font": ["Noto Sans Bold"],
          "text-size": 14,
          "text-offset": [0, -0.25],
          "text-allow-overlap": true,
        },
        paint: { "text-color": "#FFF8F0" },
      });

      map.addLayer({
        id: "festas-pontos",
        type: "symbol",
        source: "festas",
        filter: ["!", ["has", "point_count"]],
        layout: {
          "icon-image": [
            "match",
            ["get", "estado_temporal"],
            "a_decorrer",
            "pin-a-decorrer",
            "em_breve",
            "pin-em-breve",
            "pin-futuro",
          ],
          "icon-size": ["interpolate", ["linear"], ["zoom"], 5, 0.54, 9, 0.62, 14, 0.72, 17, 0.8],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
        },
        paint: { "icon-opacity": 1 },
      });

      if (festaSelecionadaIdRef.current) {
        map.setPaintProperty("festas-pontos", "icon-opacity", ["case", ["==", ["get", "id"], festaSelecionadaIdRef.current], 1, 0.42]);
      }

      mapaProntoRef.current = true;
      if (sublocalizacoesPendentesRef.current.length > 0) {
        aplicarSublocalizacoes(map, sublocalizacoesPendentesRef.current);
      }
      aoCarregarRef.current?.();

      map.on("click", "clusters", async (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id;
        if (typeof clusterId !== "number") return;
        const source = map.getSource("festas") as maplibregl.GeoJSONSource;

        const [folhas, zoom] = await Promise.all([
          source.getClusterLeaves(clusterId, 100, 0),
          source.getClusterExpansionZoom(clusterId),
        ]);
        map.easeTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
        });
        escolherGrupoRef.current?.(folhas.map(paraSelecao));
      });

      map.on("click", "festas-pontos", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const sel = paraSelecao(feature);
        escolherFestaRef.current?.(sel);
        map.easeTo({
          center: sel.lngLat,
          zoom: Math.max(map.getZoom(), 15),
          padding: paddingPainel(),
          duration: 700,
          essential: true,
        });
      });

      for (const layer of ["clusters", "festas-pontos"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
    });

    return () => {
      mapaProntoRef.current = false;
      marcadoresSublocalizacaoRef.current.forEach((marcador) => marcador.remove());
      map.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0 }}
      aria-label="Mapa de festas em Portugal"
    />
  );
});

export default FestaMap;
