import type { LatLng } from "@/lib/routing";
import { TOLL_PLAZAS, type TollPlaza } from "@/lib/toll-plazas";

export type { TollPlaza };

export type TollOnRoute = {
  id: string;
  name: string;
  highway: string;
  priceCarCents: number;
  estimated?: boolean;
  lat: number;
  lng: number;
};

/** Raio para considerar praça na rota (rodovias podem ter offset no traçado OSRM). */
const PROXIMITY_METERS = 4500;

/** Tarifa média tag por km (referência Google Maps / ANTT, carro eixo 2). */
const TAG_RATE_CENTS_PER_KM = 11.7;

/** Valor médio por praça estimada para distribuir complemento. */
const AVG_PLAZA_CENTS = 2100;

const MIN_ROUTE_KM_FOR_ESTIMATE = 25;

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

function expectedTollTotalCents(distanceMeters: number): number {
  const km = distanceMeters / 1000;
  if (km < MIN_ROUTE_KM_FOR_ESTIMATE) return 0;
  return Math.round(km * TAG_RATE_CENTS_PER_KM);
}

function estimateTollsByDistance(
  coordinates: [number, number][],
  distanceMeters: number,
): { tolls: TollOnRoute[]; totalCents: number } {
  const totalCents = expectedTollTotalCents(distanceMeters);
  if (totalCents <= 0 || coordinates.length < 2) return { tolls: [], totalCents: 0 };

  const plazas = Math.max(1, Math.round(totalCents / AVG_PLAZA_CENTS));
  const priceEach = Math.round(totalCents / plazas);
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

function supplementEstimatedTolls(
  coordinates: [number, number][],
  supplementCents: number,
  existingCount: number,
): TollOnRoute[] {
  if (supplementCents <= 0 || coordinates.length < 2) return [];

  const plazas = Math.max(1, Math.min(20, Math.round(supplementCents / AVG_PLAZA_CENTS)));
  const priceEach = Math.round(supplementCents / plazas);
  const step = Math.max(1, Math.floor(coordinates.length / (plazas + 1)));

  return Array.from({ length: plazas }, (_, i) => {
    const idx = Math.min(coordinates.length - 1, step * (i + 1));
    const [lat, lng] = coordinates[idx];
    return {
      id: `estimativa-sup-${existingCount + i + 1}`,
      name: `Praça estimada ${existingCount + i + 1}`,
      highway: "Rota",
      priceCarCents: priceEach,
      estimated: true,
      lat,
      lng,
    };
  });
}

export function calculateTollsAlongRoute(
  coordinates: [number, number][],
  distanceMeters = 0,
): { tolls: TollOnRoute[]; totalCents: number; hasEstimate: boolean } {
  const found: Array<TollOnRoute & { routeIndex: number }> = [];
  const usedIds = new Set<string>();

  for (const plaza of TOLL_PLAZAS) {
    const closest = closestPointOnPolyline({ lat: plaza.lat, lng: plaza.lng }, coordinates);
    if (closest.distance <= PROXIMITY_METERS && !usedIds.has(plaza.id)) {
      usedIds.add(plaza.id);
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

  const expectedTotal = expectedTollTotalCents(distanceMeters);
  const catalogTolls = found.map(({ routeIndex: _, ...toll }) => toll);
  const catalogTotal = catalogTolls.reduce((s, t) => s + t.priceCarCents, 0);

  if (catalogTolls.length === 0) {
    const estimated = estimateTollsByDistance(coordinates, distanceMeters);
    return { ...estimated, hasEstimate: estimated.totalCents > 0 };
  }

  const km = distanceMeters / 1000;
  const minExpectedPlazas = Math.max(1, Math.floor(km / 100));
  const undercounted =
    expectedTotal > 0 &&
    (catalogTotal < expectedTotal * 0.85 || catalogTolls.length < minExpectedPlazas);

  if (undercounted) {
    const targetTotal = Math.max(expectedTotal, catalogTotal);
    const supplementCents = Math.max(0, targetTotal - catalogTotal);
    const supplementTolls = supplementEstimatedTolls(
      coordinates,
      supplementCents,
      catalogTolls.length,
    );
    const tolls = [...catalogTolls, ...supplementTolls];
    const totalCents = catalogTotal + supplementTolls.reduce((s, t) => s + t.priceCarCents, 0);
    return { tolls, totalCents, hasEstimate: true };
  }

  return { tolls: catalogTolls, totalCents: catalogTotal, hasEstimate: false };
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
