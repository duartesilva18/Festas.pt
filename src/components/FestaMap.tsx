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
};

const FestaMap = forwardRef<FestaMapHandle, Props>(function FestaMap(
  { dados, aoEscolherFesta, aoEscolherGrupo },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const escolherFestaRef = useRef(aoEscolherFesta);
  const escolherGrupoRef = useRef(aoEscolherGrupo);
  escolherFestaRef.current = aoEscolherFesta;
  escolherGrupoRef.current = aoEscolherGrupo;

  useImperativeHandle(ref, () => ({
    reporVista() {
      mapRef.current?.fitBounds(PORTUGAL_BOUNDS, {
        padding: 24,
        duration: 900,
        essential: true,
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
        const clusterId = feature.properties?.cluster_id;
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
        map.easeTo({ center: sel.lngLat, padding: { left: 400 } });
      });

      for (const layer of ["clusters", "festas-pontos"]) {
        map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
        map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
      }
    });

    return () => {
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
