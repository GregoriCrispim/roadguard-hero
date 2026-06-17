import { useCallback, useEffect, useRef, useState } from "react";
import { CATEGORIAS, type CategoriaKey } from "@/lib/categorias";
import { bearingBetween } from "@/lib/navigation";
import type { RouteResult } from "@/lib/routing";
import type { TollOnRoute } from "@/lib/tolls";
import { formatBRL, getTollPlazaPosition } from "@/lib/tolls";
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
  onFollowChange?: (following: boolean) => void;
};

const FOLLOW_OFFSET_RATIO = 0.24;
const NAV_ZOOM = 17;
const MIN_NAV_ZOOM = 15;
const MAX_NAV_ZOOM = 18;

function centerOnUserWithOffset(
  map: import("leaflet").Map,
  lat: number,
  lng: number,
  zoom: number,
) {
  const size = map.getSize();
  const offsetY = size.y * FOLLOW_OFFSET_RATIO;
  const point = map.project([lat, lng], zoom);
  point.y -= offsetY;
  const center = map.unproject(point, zoom);
  map.setView(center, zoom, { animate: false });
}

export function TripMap({ coords, route, navigating, reports, tolls, onFollowChange }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const userMarkerRef = useRef<import("leaflet").Marker | null>(null);
  const routeLayerRef = useRef<import("leaflet").Polyline | null>(null);
  const reportLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const tollLayerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const targetRef = useRef<{ lat: number; lng: number; heading: number | null } | null>(null);
  const prevPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const programmaticMoveRef = useRef(false);
  const routeFittedRef = useRef("");
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
    if (navigating) setFollow(true);
  }, [navigating, route?.distanceMeters, setFollow]);

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
        inertia: true,
      }).setView([-15.78, -47.93], 5);

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
      map.on("zoomstart", (e) => {
        if ((e as { originalEvent?: Event }).originalEvent) markUserDrag();
      });

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

    let heading = coords.heading;
    if ((heading == null || Number.isNaN(heading) || heading < 0) && prevPosRef.current) {
      const moved = bearingBetween(prevPosRef.current, coords);
      const dist =
        Math.abs(coords.lat - prevPosRef.current.lat) +
        Math.abs(coords.lng - prevPosRef.current.lng);
      if (dist > 0.00002) heading = moved;
    }

    targetRef.current = { lat: coords.lat, lng: coords.lng, heading };
    prevPosRef.current = { lat: coords.lat, lng: coords.lng };
  }, [coords]);

  useEffect(() => {
    if (!mapRef.current) return;
    let frame: number;

    const tick = () => {
      const map = mapRef.current;
      const target = targetRef.current;
      if (map && target && navigating && followingRef.current) {
        let zoom = map.getZoom();
        if (zoom < MIN_NAV_ZOOM) zoom = NAV_ZOOM;
        if (coords?.speed != null && coords.speed > 0) {
          const kmh = coords.speed * 3.6;
          if (kmh > 80) zoom = MIN_NAV_ZOOM;
          else if (kmh > 40) zoom = NAV_ZOOM - 1;
          else zoom = NAV_ZOOM;
        } else {
          zoom = NAV_ZOOM;
        }
        zoom = Math.min(MAX_NAV_ZOOM, Math.max(MIN_NAV_ZOOM, zoom));

        programmaticMoveRef.current = true;
        centerOnUserWithOffset(map, target.lat, target.lng, zoom);
        programmaticMoveRef.current = false;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [navigating, coords?.speed]);

  useEffect(() => {
    if (!mapRef.current || !coords) return;
    (async () => {
      const L = (await import("leaflet")).default;
      const map = mapRef.current!;
      const target = targetRef.current;
      const heading = target?.heading ?? 0;

      const icon = L.divIcon({
        className: "",
        html: `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;transform:rotate(${heading}deg);filter:drop-shadow(0 2px 6px rgba(0,0,0,.45))">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="#2563EB" stroke="#fff" stroke-width="1.5">
            <path d="M12 2 L20 20 L12 16 L4 20 Z"/>
          </svg>
        </div>`,
        iconSize: [44, 44],
        iconAnchor: [22, 22],
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
  }, [coords]);

  useEffect(() => {
    if (!route?.coordinates.length) return;

    const key = `${route.coordinates.length}-${route.distanceMeters}`;
    if (routeFittedRef.current === key) return;

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

      if (!navigating) {
        const bounds = routeLayerRef.current.getBounds();
        if (coords) bounds.extend([coords.lat, coords.lng]);
        programmaticMoveRef.current = true;
        map.fitBounds(bounds, { padding: [80, 48], maxZoom: 15 });
        programmaticMoveRef.current = false;
      } else if (coords) {
        programmaticMoveRef.current = true;
        centerOnUserWithOffset(map, coords.lat, coords.lng, NAV_ZOOM);
        programmaticMoveRef.current = false;
      }

      routeFittedRef.current = key;
    })();

    return () => {
      cancelled = true;
    };
  }, [route, navigating]);

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

  const handleRecenter = () => {
    const map = mapRef.current;
    const target = targetRef.current;
    if (!map || !target) return;
    setFollow(true);
    programmaticMoveRef.current = true;
    centerOnUserWithOffset(map, target.lat, target.lng, NAV_ZOOM);
    programmaticMoveRef.current = false;
  };

  return (
    <>
      <div ref={ref} className="absolute inset-0 z-0" />

      {navigating && !following && (
        <button
          type="button"
          onClick={handleRecenter}
          className="pointer-events-auto absolute bottom-36 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-semibold shadow-2xl ring-1 ring-border"
        >
          <LocateFixed className="h-4 w-4 text-primary" />
          Recentralizar
        </button>
      )}
    </>
  );
}
