"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FestasGeoJSON, FestaFeature } from "@/lib/eventos";
import { CORES, type FestaSelecionada } from "@/lib/festa-ui";
import mascaraPortugal from "@/data/mascara-portugal.json";

const PORTUGAL_BOUNDS: [[number, number], [number, number]] = [
  [-9.75, 36.8],
  [-6.1, 42.25],
];

// O centro da camara fica sempre sobre Portugal: ve-se Espanha nas margens,
// mas nao e possivel navegar para la.
const CENTRO_LIMITES = { lngMin: -9.4, lngMax: -6.7, latMin: 37.0, latMax: 42.0 };

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

function pinSVG(cor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="256" height="256">
    <path d="M32 4 C18.7 4 9 14.2 9 27.2 C9 42 27 56.8 31 59.8 a1.6 1.6 0 0 0 2 0 C37 56.8 55 42 55 27.2 C55 14.2 45.3 4 32 4 Z" fill="${cor}"/>
    <circle cx="32" cy="27" r="13" fill="#FFF8F0"/>
    <path d="M32 17 l2.2 6.2 6.2 2.2 -6.2 2.2 -2.2 6.2 -2.2 -6.2 -6.2 -2.2 6.2 -2.2 Z" fill="${cor === "#F97B16" ? "#1A2E4F" : "#F97B16"}"/>
    <circle cx="22" cy="20" r="1.6" fill="#1A2E4F"/>
    <circle cx="42" cy="20" r="1.6" fill="#1A2E4F"/>
    <circle cx="24" cy="35" r="1.6" fill="#1A2E4F"/>
    <circle cx="40" cy="35" r="1.6" fill="#1A2E4F"/>
  </svg>`;
}

function carregarPin(map: maplibregl.Map, id: string, cor: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new window.Image(256, 256);
    img.onload = () => {
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 4 });
      resolve();
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSVG(cor))}`;
  });
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
  return {
    props,
    lngLat: (f.geometry as GeoJSON.Point).coordinates as [number, number],
  };
}

type Props = {
  dados: FestasGeoJSON;
  aoEscolherFesta?: (sel: FestaSelecionada) => void;
  aoEscolherGrupo?: (sels: FestaSelecionada[]) => void;
};

export type FestaMapHandle = {
  reporVista: () => void;
  focarFesta: (lngLat: [number, number]) => void;
  afastarFesta: (lngLat: [number, number]) => void;
  focarSublocalizacao: (local: { lng: number; lat: number; nome: string }) => void;
  mostrarSublocalizacoes: (locais: { lng: number; lat: number; nome: string; tipo: string }[]) => void;
};

const PIN_RECINTO: Record<string, { icone: string; cor: string; descricao: string }> = {
  estacionamento: { icone: "P", cor: "#2B6CB0", descricao: "Estacionamento" },
  entrada: { icone: "→", cor: "#20856D", descricao: "Entrada" },
  palco: { icone: "♬", cor: "#7C4DAD", descricao: "Palco" },
  after: { icone: "✦", cor: "#5E3A9E", descricao: "After" },
  bar: { icone: "☕", cor: "#B75B25", descricao: "Bar" },
  wc: { icone: "WC", cor: "#167F99", descricao: "Casas de banho" },
  primeiros_socorros: { icone: "+", cor: "#C43D4B", descricao: "Primeiros socorros" },
  outro: { icone: "•", cor: "#64748B", descricao: "Ponto no recinto" },
};

function criarPinRecinto(tipo: string, nome: string) {
  const configuracao = PIN_RECINTO[tipo] ?? PIN_RECINTO.outro;
  const elemento = document.createElement("div");
  elemento.className = "mapa-sublocalizacao";
  elemento.style.setProperty("--pin-cor", configuracao.cor);
  elemento.setAttribute("aria-label", `${configuracao.descricao}: ${nome}`);
  elemento.setAttribute("title", `${configuracao.descricao}: ${nome}`);
  elemento.innerHTML = `<span>${configuracao.icone}</span>`;
  return elemento;
}

function popupSublocalizacao(local: { nome: string; tipo: string; lat: number; lng: number }) {
  const conteudo = document.createElement("div");
  conteudo.className = "mapa-popup-recinto";
  const tipo = document.createElement("span");
  tipo.className = "mapa-popup-tipo";
  tipo.textContent = (PIN_RECINTO[local.tipo] ?? PIN_RECINTO.outro).descricao;
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
  { dados, aoEscolherFesta, aoEscolherGrupo },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const marcadoresSublocalizacaoRef = useRef<maplibregl.Marker[]>([]);
  const escolherFestaRef = useRef(aoEscolherFesta);
  const escolherGrupoRef = useRef(aoEscolherGrupo);
  escolherFestaRef.current = aoEscolherFesta;
  escolherGrupoRef.current = aoEscolherGrupo;

  useImperativeHandle(ref, () => ({
    reporVista() {
      marcadoresSublocalizacaoRef.current.forEach((marcador) => marcador.remove());
      marcadoresSublocalizacaoRef.current = [];
      mapRef.current?.fitBounds(PORTUGAL_BOUNDS, {
        padding: 24,
        duration: 900,
        essential: true,
      });
    },
    focarFesta(lngLat) {
      const map = mapRef.current;
      if (!map) return;
      map.easeTo({ center: lngLat, zoom: Math.max(map.getZoom(), 15), padding: { left: 450 }, duration: 700, essential: true });
    },
    afastarFesta(lngLat) {
      const map = mapRef.current;
      if (!map) return;
      marcadoresSublocalizacaoRef.current.forEach((marcador) => marcador.remove());
      marcadoresSublocalizacaoRef.current = [];
      map.easeTo({ center: lngLat, zoom: 12, padding: { left: 450 }, duration: 650, essential: true });
    },
    focarSublocalizacao(local) {
      const map = mapRef.current;
      if (!map) return;
      const marcador = marcadoresSublocalizacaoRef.current.find((item) => item.getLngLat().lng === local.lng && item.getLngLat().lat === local.lat);
      marcador?.togglePopup();
      map.easeTo({ center: [local.lng, local.lat], zoom: Math.max(map.getZoom(), 16), padding: { left: 440 }, duration: 600 });
    },
    mostrarSublocalizacoes(locais) {
      const map = mapRef.current;
      if (!map) return;
      marcadoresSublocalizacaoRef.current.forEach((marcador) => marcador.remove());
      marcadoresSublocalizacaoRef.current = locais.map((local) => {
        const elemento = criarPinRecinto(local.tipo, local.nome);
        elemento.addEventListener("click", () => {
          map.easeTo({
            center: [local.lng, local.lat],
            zoom: Math.max(map.getZoom(), 17),
            padding: { left: 440 },
            duration: 550,
            essential: true,
          });
        });
        return new maplibregl.Marker({ element: elemento, anchor: "bottom" })
          .setLngLat([local.lng, local.lat])
          .setPopup(new maplibregl.Popup({ offset: 26 }).setDOMContent(popupSublocalizacao(local)))
          .addTo(map);
      });
    },
  }));

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

    map.addControl(new maplibregl.AttributionControl({ compact: true }), "bottom-right");
    vigiarCentro(map);
    map.once("idle", () => {
      containerRef.current
        ?.querySelector(".maplibregl-ctrl-attrib")
        ?.classList.remove("maplibregl-compact-show");
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      "bottom-right",
    );

    map.on("load", async () => {
      await Promise.all([
        carregarPin(map, "pin-a-decorrer", CORES.a_decorrer),
        carregarPin(map, "pin-em-breve", CORES.em_breve),
        carregarPin(map, "pin-futuro", CORES.futuro),
      ]);

      // Vela sobre tudo o que nao e Portugal continental (esbate a Espanha).
      map.addSource("mascara", {
        type: "geojson",
        data: mascaraPortugal as GeoJSON.FeatureCollection,
      });
      map.addLayer({
        id: "mascara-fora",
        type: "fill",
        source: "mascara",
        paint: { "fill-color": "#EDF1F5", "fill-opacity": 0.7 },
      });
      map.addLayer({
        id: "fronteira-pt",
        type: "line",
        source: "mascara",
        paint: { "line-color": "#EC2456", "line-width": 1.2, "line-opacity": 0.45 },
      });

      map.addSource("festas", {
        type: "geojson",
        data: dados,
        cluster: true,
        clusterMaxZoom: 11,
        clusterRadius: 46,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "festas",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": "#EC2456",
          "circle-radius": ["step", ["get", "point_count"], 18, 10, 24, 30, 30],
          "circle-stroke-width": 3,
          "circle-stroke-color": "#FFF8F0",
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
          "icon-size": ["match", ["get", "estado_temporal"], "a_decorrer", 0.72, 0.62],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
        },
      });

      map.on("click", "clusters", async (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        if (!feature) return;
        const clusterId = feature.properties?.cluster_id;
        if (typeof clusterId !== "number") return;
        const source = map.getSource("festas") as maplibregl.GeoJSONSource;

        const folhas = await source.getClusterLeaves(clusterId, 100, 0);
        escolherGrupoRef.current?.(folhas.map(paraSelecao));

        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
        });
      });

      map.on("click", "festas-pontos", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const sel = paraSelecao(feature);
        escolherFestaRef.current?.(sel);
        map.easeTo({
          center: sel.lngLat,
          zoom: Math.max(map.getZoom(), 15),
          padding: { left: 450 },
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
      marcadoresSublocalizacaoRef.current.forEach((marcador) => marcador.remove());
      map.remove();
      mapRef.current = null;
    };
  }, [dados]);

  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0 }}
      aria-label="Mapa de festas em Portugal"
    />
  );
});

export default FestaMap;
