import { useEffect, useRef } from "react";
import { CATEGORIAS, type CategoriaKey } from "@/lib/categorias";
import type { RouteResult } from "@/lib/routing";
import type { TollOnRoute } from "@/lib/tolls";
import { formatBRL, getTollPlazaPosition } from "@/lib/tolls";

export type TripReportMarker = {
  id: string;
  lat: number;
  lng: number;
  categoria: CategoriaKey;
};

type Props = {
  coords: { lat: number; lng: number; heading: number | null } | null;
  route: RouteResult | null;
  tracking: boolean;
  reports: TripReportMarker[];
  tolls: TollOnRoute[];
};

export function TripMap({ coords, route, tracking, reports, tolls }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const userMarkerRef = useRef<import("leaflet").CircleMarker | null>(null);
  const routeLayerRef = useRef<import("leaflet").Polyline | null>(null);
  const reportLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tollLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const lastPanRef = useRef(0);
  const targetRef = useRef<{ lat: number; lng: number } | null>(null);
  const routeKeyRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !ref.current || mapRef.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      if (cancelled) return;

      const map = L.map(ref.current, {
        zoomControl: false,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
      }).setView([-15.78, -47.93], 5);

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OSM",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      reportLayerRef.current = L.layerGroup().addTo(map);
      tollLayerRef.current = L.layerGroup().addTo(map);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!coords) return;
    targetRef.current = { lat: coords.lat, lng: coords.lng };
  }, [coords]);

  useEffect(() => {
    if (!mapRef.current) return;
    let frame: number;

    const animate = () => {
      const map = mapRef.current;
      const target = targetRef.current;
      if (map && target && tracking) {
        const now = Date.now();
        if (now - lastPanRef.current > 80) {
          const center = map.getCenter();
          const nextLat = center.lat + (target.lat - center.lat) * 0.22;
          const nextLng = center.lng + (target.lng - center.lng) * 0.22;
          map.panTo([nextLat, nextLng], { animate: false, noMoveStart: true });
          lastPanRef.current = now;
        }
      }
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [tracking]);

  useEffect(() => {
    if (!mapRef.current || !coords) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current!;

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.circleMarker([coords.lat, coords.lng], {
          radius: 11,
          color: "#fff",
          weight: 3,
          fillColor: "#2563EB",
          fillOpacity: 1,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([coords.lat, coords.lng]);
      }
    })();
  }, [coords]);

  useEffect(() => {
    if (!route?.coordinates.length) return;

    const key = `${route.coordinates.length}-${route.distanceMeters}`;
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;

      for (let i = 0; i < 40 && !mapRef.current; i++) {
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
      }
      if (!mapRef.current) return;

      const map = mapRef.current;
      routeLayerRef.current?.remove();
      routeLayerRef.current = L.polyline(route.coordinates, {
        color: "#2563EB",
        weight: 7,
        opacity: 0.9,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      const bounds = routeLayerRef.current.getBounds();
      if (coords) bounds.extend([coords.lat, coords.lng]);
      map.fitBounds(bounds, { padding: [80, 48], maxZoom: 15 });
      routeKeyRef.current = key;
    })();

    return () => {
      cancelled = true;
    };
  }, [route, coords]);

  useEffect(() => {
    if (!mapRef.current || !reportLayerRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const layer = reportLayerRef.current!;
      layer.clearLayers();

      for (const r of reports) {
        const c = CATEGORIAS[r.categoria];
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${c?.cor ?? "#22C55E"};border:3px solid white;box-shadow:0 2px 10px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;font-size:14px">⚠</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        L.marker([r.lat, r.lng], { icon })
          .addTo(layer)
          .bindPopup(`<b>${c?.label ?? "Reporte"}</b><br/><small>Seu reporte nesta viagem</small>`);
      }
    })();
  }, [reports]);

  useEffect(() => {
    if (!mapRef.current || !tollLayerRef.current) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const layer = tollLayerRef.current!;
      layer.clearLayers();

      for (const toll of tolls) {
        if (toll.estimated) continue;
        const plaza = getTollPlazaPosition(toll.id);
        if (!plaza) continue;
        const icon = L.divIcon({
          className: "",
          html: `<div style="padding:2px 6px;border-radius:8px;background:#F59E0B;color:#111;font-size:10px;font-weight:700;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)">$</div>`,
          iconAnchor: [8, 8],
        });
        L.marker([plaza.lat, plaza.lng], { icon })
          .addTo(layer)
          .bindPopup(`<b>${toll.name}</b><br/>${toll.highway}<br/>${formatBRL(toll.priceCarCents)}`);
      }
    })();
  }, [tolls]);

  return <div ref={ref} className="absolute inset-0 z-0" />;
}
