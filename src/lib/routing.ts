export type LatLng = { lat: number; lng: number };

export type GeocodeResult = {
  label: string;
  lat: number;
  lng: number;
};

export type RouteResult = {
  distanceMeters: number;
  durationSeconds: number;
  coordinates: [number, number][];
};

const searchCache = new Map<string, { results: GeocodeResult[]; ts: number }>();
const CACHE_TTL_MS = 120_000;

function formatPhotonLabel(props: Record<string, string | undefined>): string {
  const parts = [props.name, props.street, props.city, props.state, props.country].filter(Boolean);
  return [...new Set(parts)].join(", ");
}

async function searchPhoton(q: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("lang", "pt");

  const res = await fetch(url.toString(), { signal, headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Photon falhou");

  const data = (await res.json()) as {
    features?: Array<{
      geometry: { coordinates: [number, number] };
      properties: Record<string, string | undefined>;
    }>;
  };

  return (data.features ?? [])
    .map((f) => ({
      label: formatPhotonLabel(f.properties),
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
    }))
    .filter((r) => r.label.length > 0);
}

async function searchNominatim(q: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", q);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "6");
  url.searchParams.set("countrycodes", "br");
  url.searchParams.set("addressdetails", "0");

  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error("Nominatim falhou");

  const data = (await res.json()) as Array<{ display_name: string; lat: string; lon: string }>;
  return data.map((item) => ({
    label: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<GeocodeResult[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const cacheKey = q.toLowerCase();
  const cached = searchCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.results;

  try {
    const results = await searchPhoton(q, signal);
    if (results.length > 0) {
      searchCache.set(cacheKey, { results, ts: Date.now() });
      return results;
    }
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
  }

  const fallback = await searchNominatim(q, signal);
  searchCache.set(cacheKey, { results: fallback, ts: Date.now() });
  return fallback;
}

export async function fetchDrivingRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;

  const res = await fetch(url);
  if (!res.ok) throw new Error("Falha ao calcular rota");

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("Rota não encontrada");

  const coordinates = (route.geometry?.coordinates ?? []) as [number, number][];
  return {
    distanceMeters: route.distance ?? 0,
    durationSeconds: route.duration ?? 0,
    coordinates: coordinates.map(([lng, lat]) => [lat, lng] as [number, number]),
  };
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

export function formatDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}min` : `${h}h`;
}
