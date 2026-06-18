import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIAS, type CategoriaKey } from "@/lib/categorias";
import {
  navigationHeading,
  smoothBearing,
} from "@/lib/navigation";
import type { RouteResult } from "@/lib/routing";
import { formatBRL, getTollMarkerPosition, type TollOnRoute } from "@/lib/tolls";
import { LocateFixed } from "lucide-react";

export type TripReportMarker = {
  id: string;
  lat: number;
  lng: number;
  categoria: CategoriaKey;
};

type Props = {
  coords: { lat: number; lng: number; heading: number | null; speed: number | null } | null;
  route: RouteResult | null;
  navigating: boolean;
  reports: TripReportMarker[];
  tolls: TollOnRoute[];
  bottomInset?: number;
  speedKmh?: number | null;
  onFollowChange?: (following: boolean) => void;
};

/** Posição vertical do cursor GPS na tela (fração da altura, a partir do topo). */
export const GPS_CURSOR_SCREEN_Y = 0.66;
const FOLLOW_OFFSET_RATIO = 0.32;
const NAV_ZOOM = 18;
const ROUTE_COLOR = "#33D1FF";

type RotatableMap = import("leaflet").Map & {
  setBearing(bearing: number): import("leaflet").Map;
  getBearing(): number;
};

function centerOnUserWithOffset(
  map: import("leaflet").Map,
  lat: number,
  lng: number,
  zoom: number,
  bearing = 0,
) {
  const size = map.getSize();
  const offsetY = size.y * FOLLOW_OFFSET_RATIO;
  const point = map.project([lat, lng], zoom);
  point.y -= offsetY;
  const center = map.unproject(point, zoom);
  const rotMap = map as RotatableMap;
  if (typeof rotMap.setBearing === "function") {
    rotMap.setBearing(bearing);
  }
  map.setView(center, zoom, { animate: false });
}

export function TripMap({
  coords,
  route,
  navigating,
  reports,
  tolls,
  bottomInset = 0,
  speedKmh = null,
  onFollowChange,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<RotatableMap | null>(null);
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const routeLayerRef = useRef<import("leaflet").Polyline | null>(null);
  const reportLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tollLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const targetRef = useRef<{ lat: number; lng: number; heading: number } | null>(null);
  const bearingRef = useRef(0);
  const programmaticMoveRef = useRef(false);
  const routeFittedRef = useRef("");
  const gpsFocusedRef = useRef(false);
  const [following, setFollowing] = useState(true);
  const followingRef = useRef(true);
  const navigatingRef = useRef(navigating);

  navigatingRef.current = navigating;

  const setFollow = useCallback(
    (value: boolean) => {
      followingRef.current = value;
      setFollowing(value);
      onFollowChange?.(value);
    },
    [onFollowChange],
  );

  useEffect(() => {
    if (!navigating) return;
    setFollow(true);
    gpsFocusedRef.current = false;
    bearingRef.current = 0;
  }, [navigating, setFollow]);

  useEffect(() => {
    if (!coords || !mapRef.current) return;

    let cancelled = false;
    (async () => {
      for (let i = 0; i < 40 && !mapRef.current; i++) {
        await new Promise((r) => setTimeout(r, 50));
        if (cancelled) return;
      }
      if (!mapRef.current || cancelled) return;

      const map = mapRef.current;
      programmaticMoveRef.current = true;

      if (navigating) {
        if (!gpsFocusedRef.current) {
          const bearing = route?.coordinates.length
            ? navigationHeading(coords, route.coordinates, coords.heading, speedKmh)
            : coords.heading ?? 0;
          bearingRef.current = bearing;
          centerOnUserWithOffset(map, coords.lat, coords.lng, NAV_ZOOM, bearing);
          gpsFocusedRef.current = true;
        }
      } else if (route?.coordinates.length && !gpsFocusedRef.current) {
        const L = (await import("leaflet")).default;
        map.setBearing(0);
        const bounds = L.latLngBounds(route.coordinates);
        bounds.extend([coords.lat, coords.lng]);
        map.fitBounds(bounds, { padding: [80, 48], maxZoom: 15 });
        gpsFocusedRef.current = true;
      } else if (!route && !gpsFocusedRef.current) {
        map.setBearing(0);
        map.setView([coords.lat, coords.lng], NAV_ZOOM);
        gpsFocusedRef.current = true;
      }

      programmaticMoveRef.current = false;
    })();

    return () => {
      cancelled = true;
    };
  }, [coords?.lat, coords?.lng, navigating, route, speedKmh]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof window === "undefined" || !ref.current || mapRef.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet-rotate");
      await import("leaflet/dist/leaflet.css");
      if (cancelled) return;

      const map = L.map(ref.current, {
        zoomControl: false,
        zoomAnimation: true,
        fadeAnimation: true,
        markerZoomAnimation: true,
        inertia: true,
        rotate: true,
        bearing: 0,
        touchRotate: false,
      }).setView([-15.78, -47.93], 5) as RotatableMap;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OSM",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      reportLayerRef.current = L.layerGroup().addTo(map);
      tollLayerRef.current = L.layerGroup().addTo(map);

      const markUserDrag = () => {
        if (programmaticMoveRef.current || !navigatingRef.current) return;
        setFollow(false);
      };

      map.on("dragstart", markUserDrag);
      mapRef.current = map;
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [setFollow]);

  useEffect(() => {
    if (!coords) return;

    const heading =
      navigating && route?.coordinates.length
        ? navigationHeading(coords, route.coordinates, coords.heading, speedKmh)
        : coords.heading ?? bearingRef.current;

    targetRef.current = { lat: coords.lat, lng: coords.lng, heading };
    if (navigating) {
      bearingRef.current = smoothBearing(bearingRef.current, heading);
    }
  }, [coords, navigating, route, speedKmh]);

  useEffect(() => {
    if (!mapRef.current) return;
    let frame: number;

    const tick = () => {
      const map = mapRef.current;
      const target = targetRef.current;
      if (map && target && navigating && followingRef.current) {
        const zoom = Math.max(map.getZoom(), NAV_ZOOM);
        programmaticMoveRef.current = true;
        centerOnUserWithOffset(map, target.lat, target.lng, zoom, bearingRef.current);
        programmaticMoveRef.current = false;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [navigating]);

  useEffect(() => {
    if (!mapRef.current || !coords || navigating) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }

    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current!;
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:52px;height:52px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 3px 8px rgba(0,0,0,.5))">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="#2563EB" stroke="#fff" stroke-width="1.5">
            <path d="M12 2 L20 20 L12 16 L4 20 Z"/>
          </svg>
        </div>`,
        iconSize: [52, 52],
        iconAnchor: [26, 26],
      });

      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker([coords.lat, coords.lng], {
          icon,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        userMarkerRef.current.setLatLng([coords.lat, coords.lng]);
        userMarkerRef.current.setIcon(icon);
      }
    })();
  }, [coords, navigating]);

  useEffect(() => {
    if (!route?.coordinates.length) return;

    const last = route.coordinates[route.coordinates.length - 1];
    const key = `${route.distanceMeters}-${route.coordinates.length}-${route.coordinates[0]?.join(",")}-${last?.join(",")}`;
    if (routeFittedRef.current === key) return;
    gpsFocusedRef.current = false;

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
        color: navigating ? ROUTE_COLOR : "#2563EB",
        weight: navigating ? 9 : 7,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      if (!navigating) {
        map.setBearing(0);
        const bounds = routeLayerRef.current.getBounds();
        if (coords) bounds.extend([coords.lat, coords.lng]);
        programmaticMoveRef.current = true;
        map.fitBounds(bounds, { padding: [80, 48], maxZoom: 15 });
        programmaticMoveRef.current = false;
      } else if (coords) {
        const bearing = navigationHeading(coords, route.coordinates, coords.heading, speedKmh);
        bearingRef.current = bearing;
        programmaticMoveRef.current = true;
        centerOnUserWithOffset(map, coords.lat, coords.lng, NAV_ZOOM, bearing);
        programmaticMoveRef.current = false;
      }

      routeFittedRef.current = key;
      if (!navigating && coords) gpsFocusedRef.current = true;
    })();

    return () => {
      cancelled = true;
    };
  }, [route, navigating, coords, speedKmh]);

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
        const pos = getTollMarkerPosition(toll);
        const icon = L.divIcon({
          className: "",
          html: `<div style="padding:2px 6px;border-radius:8px;background:#F59E0B;color:#111;font-size:10px;font-weight:700;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.35)">$</div>`,
          iconAnchor: [8, 8],
        });
        L.marker([pos.lat, pos.lng], { icon })
          .addTo(layer)
          .bindPopup(
            `<b>${toll.name}</b><br/>${toll.highway}<br/>${formatBRL(toll.priceCarCents)}${toll.estimated ? "<br/><small>estimativa</small>" : ""}`,
          );
      }
    })();
  }, [tolls]);

  const handleRecenter = () => {
    const map = mapRef.current;
    const target = targetRef.current;
    if (!map || !target) return;
    setFollow(true);
    programmaticMoveRef.current = true;
    const zoom = Math.max(map.getZoom(), NAV_ZOOM);
    centerOnUserWithOffset(map, target.lat, target.lng, zoom, bearingRef.current);
    programmaticMoveRef.current = false;
  };

  return (
    <>
      <div ref={ref} className="absolute inset-0 z-0" />

      {navigating && (
        <div
          className="pointer-events-none absolute left-1/2 z-[15] -translate-x-1/2 -translate-y-1/2"
          style={{ top: `${GPS_CURSOR_SCREEN_Y * 100}%` }}
        >
          <svg
            width="64"
            height="64"
            viewBox="0 0 64 64"
            className="drop-shadow-[0_4px_12px_rgba(0,0,0,0.55)]"
            aria-hidden
          >
            <path
              d="M32 6 L54 54 L32 44 L10 54 Z"
              fill="#33D1FF"
              stroke="#ffffff"
              strokeWidth="3"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      )}

      {navigating && !following && (
        <button
          type="button"
          onClick={handleRecenter}
          className="pointer-events-auto absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold shadow-2xl ring-1 ring-border"
          style={{ bottom: `calc(${bottomInset + 16}px + env(safe-area-inset-bottom))` }}
        >
          <LocateFixed className="h-4 w-4 text-primary" />
          Recentralizar
        </button>
      )}
    </>
  );
}
