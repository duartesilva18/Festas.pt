"use client";

import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { FestasGeoJSON, FestaFeature } from "@/lib/eventos";

const CORES = {
  a_decorrer: "#E63946",
  em_breve: "#FFB703",
  futuro: "#457B9D",
} as const;

const PORTUGAL_BOUNDS: [[number, number], [number, number]] = [
  [-9.75, 36.8],
  [-6.1, 42.25],
];

function pinSVG(cor: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
    <path d="M32 4 C18.7 4 9 14.2 9 27.2 C9 42 27 56.8 31 59.8 a1.6 1.6 0 0 0 2 0 C37 56.8 55 42 55 27.2 C55 14.2 45.3 4 32 4 Z" fill="${cor}"/>
    <circle cx="32" cy="27" r="13" fill="#FFF8F0"/>
    <path d="M32 17 l2.2 6.2 6.2 2.2 -6.2 2.2 -2.2 6.2 -2.2 -6.2 -6.2 -2.2 6.2 -2.2 Z" fill="${cor === "#FFB703" ? "#E63946" : "#FFB703"}"/>
    <circle cx="22" cy="20" r="1.6" fill="#2A9D8F"/>
    <circle cx="42" cy="20" r="1.6" fill="#2A9D8F"/>
    <circle cx="24" cy="35" r="1.6" fill="#1D3557"/>
    <circle cx="40" cy="35" r="1.6" fill="#1D3557"/>
  </svg>`;
}

function carregarPin(map: maplibregl.Map, id: string, cor: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const img = new window.Image(64, 64);
    img.onload = () => {
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: 2 });
      resolve();
    };
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pinSVG(cor))}`;
  });
}

function formatarDatas(inicio: string, fim: string | null): string {
  const fmt = new Intl.DateTimeFormat("pt-PT", { day: "numeric", month: "long" });
  const dInicio = new Date(inicio + "T12:00:00");
  if (!fim || fim === inicio) return fmt.format(dInicio);
  const dFim = new Date(fim + "T12:00:00");
  if (dInicio.getMonth() === dFim.getMonth()) {
    return `${dInicio.getDate()}–${dFim.getDate()} de ${new Intl.DateTimeFormat("pt-PT", { month: "long" }).format(dFim)}`;
  }
  return `${fmt.format(dInicio)} – ${fmt.format(dFim)}`;
}

function popupHTML(p: FestaFeature["properties"]): string {
  const cor = CORES[p.estado_temporal];
  const etiqueta =
    p.estado_temporal === "a_decorrer"
      ? "A decorrer"
      : p.estado_temporal === "em_breve"
        ? "Muito em breve"
        : "Mais tarde";
  return `
    <div style="font-family:inherit;min-width:220px;max-width:260px">
      <span style="display:inline-block;background:${cor};color:#FFF8F0;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;padding:2px 8px;border-radius:999px">${etiqueta}</span>
      <h3 style="margin:8px 0 2px;font-size:16px;line-height:1.25;color:#1D3557">${p.nome}</h3>
      <p style="margin:0 0 4px;font-size:13px;color:#457B9D">${p.concelho} · ${p.distrito}</p>
      <p style="margin:0;font-size:13px;font-weight:600;color:#1D3557">${formatarDatas(p.data_inicio, p.data_fim)}</p>
      <a href="/festas/${p.concelho_slug}/${p.slug}"
         style="display:inline-block;margin-top:10px;font-size:13px;font-weight:700;color:${CORES.a_decorrer};text-decoration:none">Ver festa →</a>
    </div>`;
}

export default function FestaMap({ dados }: { dados: FestasGeoJSON }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      bounds: PORTUGAL_BOUNDS,
      fitBoundsOptions: { padding: 24 },
      attributionControl: { compact: true },
    });
    mapRef.current = map;

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
          "circle-color": "#E63946",
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
          "icon-size": ["match", ["get", "estado_temporal"], "a_decorrer", 1.15, 1],
          "icon-anchor": "bottom",
          "icon-allow-overlap": true,
        },
      });

      map.on("click", "clusters", async (e) => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        const clusterId = feature.properties?.cluster_id;
        const source = map.getSource("festas") as maplibregl.GeoJSONSource;
        const zoom = await source.getClusterExpansionZoom(clusterId);
        map.easeTo({
          center: (feature.geometry as GeoJSON.Point).coordinates as [number, number],
          zoom,
        });
      });

      map.on("click", "festas-pontos", (e) => {
        const feature = e.features?.[0];
        if (!feature) return;
        const coords = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        const props = feature.properties as unknown as FestaFeature["properties"];
        new maplibregl.Popup({ offset: [0, -38], maxWidth: "300px" })
          .setLngLat(coords)
          .setHTML(popupHTML(props))
          .addTo(map);
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
}
