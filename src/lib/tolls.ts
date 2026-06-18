import type { LatLng } from "@/lib/routing";

export type TollPlaza = {
  id: string;
  name: string;
  highway: string;
  lat: number;
  lng: number;
  priceCarCents: number;
};

export type TollOnRoute = {
  id: string;
  name: string;
  highway: string;
  priceCarCents: number;
  estimated?: boolean;
  lat: number;
  lng: number;
};

/** Praças de pedágio aproximadas em rodovias brasileiras (valores referência carro) */
const TOLL_PLAZAS: TollPlaza[] = [
  { id: "sp-imigrantes", name: "Imigrantes", highway: "SP-160", lat: -23.8512, lng: -46.7185, priceCarCents: 3420 },
  { id: "sp-anchieta", name: "Anchieta", highway: "SP-150", lat: -23.912, lng: -46.389, priceCarCents: 2890 },
  { id: "sp-cubatao", name: "Cubatão", highway: "BR-101", lat: -23.895, lng: -46.425, priceCarCents: 2650 },
  { id: "sp-castelo", name: "Castelo Branco", highway: "SP-280", lat: -23.452, lng: -46.876, priceCarCents: 3150 },
  { id: "sp-band", name: "Bandeirantes", highway: "SP-348", lat: -23.012, lng: -47.134, priceCarCents: 2780 },
  { id: "sp-raposo", name: "Raposo Tavares", highway: "SP-270", lat: -23.589, lng: -46.752, priceCarCents: 2540 },
  { id: "sp-regis", name: "Régis Bittencourt", highway: "BR-116", lat: -24.015, lng: -46.412, priceCarCents: 2980 },
  { id: "sp-dutra-1", name: "Dutra — Guarulhos", highway: "BR-116", lat: -23.462, lng: -46.533, priceCarCents: 2240 },
  { id: "sp-dutra-2", name: "Dutra — Jacareí", highway: "BR-116", lat: -23.305, lng: -45.965, priceCarCents: 2180 },
  { id: "rj-arcored", name: "Arco Redentor", highway: "BR-101", lat: -22.903, lng: -43.178, priceCarCents: 1890 },
  { id: "rj-teresopolis", name: "Teresópolis", highway: "BR-116", lat: -22.412, lng: -42.965, priceCarCents: 2240 },
  { id: "rj-brumadinho", name: "BR-040", highway: "BR-040", lat: -20.145, lng: -44.2, priceCarCents: 1980 },
  { id: "mg-bh-rio", name: "Conceição do Mato Dentro", highway: "BR-381", lat: -19.032, lng: -43.425, priceCarCents: 3680 },
  { id: "mg-contagem", name: "Contagem", highway: "BR-381", lat: -19.945, lng: -44.052, priceCarCents: 2120 },
  { id: "mg-jf", name: "Juiz de Fora", highway: "BR-040", lat: -21.764, lng: -43.35, priceCarCents: 1850 },
  { id: "pr-curitiba", name: "Curitiba", highway: "BR-116", lat: -25.428, lng: -49.273, priceCarCents: 1950 },
  { id: "pr-litoral", name: "Litoral Paranaense", highway: "BR-277", lat: -25.542, lng: -48.512, priceCarCents: 1680 },
  { id: "pr-ponta-grossa", name: "Ponta Grossa", highway: "BR-376", lat: -25.095, lng: -50.161, priceCarCents: 1720 },
  { id: "sc-florianopolis", name: "Florianópolis", highway: "BR-101", lat: -27.595, lng: -48.548, priceCarCents: 1780 },
  { id: "sc-joinville", name: "Joinville", highway: "BR-101", lat: -26.304, lng: -48.845, priceCarCents: 1650 },
  { id: "rs-porto", name: "Porto Alegre", highway: "BR-116", lat: -30.034, lng: -51.217, priceCarCents: 2050 },
  { id: "ba-salvador", name: "Salvador", highway: "BR-324", lat: -12.971, lng: -38.501, priceCarCents: 1920 },
  { id: "df-brasilia", name: "Brasília Sul", highway: "BR-040", lat: -15.839, lng: -47.923, priceCarCents: 1560 },
  { id: "go-anapolis", name: "Anápolis", highway: "BR-060", lat: -16.236, lng: -48.955, priceCarCents: 1420 },
  { id: "es-vitoria", name: "Vitória", highway: "BR-101", lat: -20.315, lng: -40.312, priceCarCents: 1650 },
  { id: "pe-recife", name: "Recife", highway: "BR-101", lat: -8.047, lng: -34.877, priceCarCents: 1580 },
  { id: "ce-fortaleza", name: "Fortaleza", highway: "BR-116", lat: -3.731, lng: -38.526, priceCarCents: 1520 },
];

const PROXIMITY_METERS = 1800;

function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
}

function closestPointOnPolyline(
  point: LatLng,
  polyline: [number, number][],
): { distance: number; lat: number; lng: number; routeIndex: number } {
  if (polyline.length === 0) {
    return { distance: Infinity, lat: point.lat, lng: point.lng, routeIndex: 0 };
  }

  let bestDist = Infinity;
  let bestLat = polyline[0][0];
  let bestLng = polyline[0][1];
  let bestIndex = 0;

  for (let i = 0; i < polyline.length - 1; i++) {
    const [lat1, lng1] = polyline[i];
    const [lat2, lng2] = polyline[i + 1];
    const latMid = (lat1 + lat2) / 2;
    const cosLat = Math.cos((latMid * Math.PI) / 180);

    const ax = lng1 * cosLat;
    const ay = lat1;
    const bx = lng2 * cosLat;
    const by = lat2;
    const px = point.lng * cosLat;
    const py = point.lat;

    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;

    let t = 0;
    if (lenSq > 0) {
      t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));
    }

    const lat = ay + t * dy;
    const lng = (ax + t * dx) / cosLat;
    const dist = haversineMeters(point, { lat, lng });

    if (dist < bestDist) {
      bestDist = dist;
      bestLat = lat;
      bestLng = lng;
      bestIndex = i;
    }
  }

  return { distance: bestDist, lat: bestLat, lng: bestLng, routeIndex: bestIndex };
}

function estimateTollsByDistance(
  coordinates: [number, number][],
  distanceMeters: number,
): { tolls: TollOnRoute[]; totalCents: number } {
  const km = distanceMeters / 1000;
  if (km < 20 || coordinates.length < 2) return { tolls: [], totalCents: 0 };

  const plazas = Math.max(1, Math.round(km / 80));
  const priceEach = Math.round((km * 18) / plazas);
  const tolls: TollOnRoute[] = Array.from({ length: plazas }, (_, i) => {
    const idx = Math.min(
      coordinates.length - 1,
      Math.max(0, Math.floor(((i + 1) / (plazas + 1)) * coordinates.length)),
    );
    const [lat, lng] = coordinates[idx];
    return {
      id: `estimativa-${i + 1}`,
      name: `Praça estimada ${i + 1}`,
      highway: "Rota",
      priceCarCents: priceEach,
      estimated: true,
      lat,
      lng,
    };
  });

  return { tolls, totalCents: priceEach * plazas };
}

export function calculateTollsAlongRoute(
  coordinates: [number, number][],
  distanceMeters = 0,
): { tolls: TollOnRoute[]; totalCents: number; hasEstimate: boolean } {
  const found: Array<TollOnRoute & { routeIndex: number }> = [];

  for (const plaza of TOLL_PLAZAS) {
    const closest = closestPointOnPolyline({ lat: plaza.lat, lng: plaza.lng }, coordinates);
    if (closest.distance <= PROXIMITY_METERS) {
      found.push({
        id: plaza.id,
        name: plaza.name,
        highway: plaza.highway,
        priceCarCents: plaza.priceCarCents,
        lat: closest.lat,
        lng: closest.lng,
        routeIndex: closest.routeIndex,
      });
    }
  }

  found.sort((a, b) => a.routeIndex - b.routeIndex);

  if (found.length > 0) {
    const tolls = found.map(({ routeIndex: _, ...toll }) => toll);
    const totalCents = tolls.reduce((s, t) => s + t.priceCarCents, 0);
    return { tolls, totalCents, hasEstimate: false };
  }

  const estimated = estimateTollsByDistance(coordinates, distanceMeters);
  return { ...estimated, hasEstimate: estimated.totalCents > 0 };
}

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function normalizePlaca(placa: string): string {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isValidPlaca(placa: string): boolean {
  const p = normalizePlaca(placa);
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(p) || /^[A-Z]{3}[0-9]{4}$/.test(p);
}

/** Posição do marcador no mapa (na rota) */
export function getTollMarkerPosition(toll: TollOnRoute): { lat: number; lng: number } {
  return { lat: toll.lat, lng: toll.lng };
}
