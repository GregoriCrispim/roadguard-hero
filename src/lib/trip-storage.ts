import type { GeocodeResult, RouteResult } from "@/lib/routing";
import type { TollOnRoute } from "@/lib/tolls";

export type StoredTrip = {
  tripId: string;
  destination: GeocodeResult;
  route: RouteResult;
  tolls: TollOnRoute[];
  tollTotalCents: number;
  startedAt: number;
  expiresAt: number;
  reportIds: string[];
  navigationStarted?: boolean;
};

const STORAGE_KEY = "roadhero_active_trip";

export function saveTrip(trip: StoredTrip) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trip));
}

export function loadTrip(): StoredTrip | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as StoredTrip;
  } catch {
    return null;
  }
}

/** Viagem salva ainda válida por tempo (ignora GPS no boot) */
export function loadActiveTrip(): StoredTrip | null {
  const trip = loadTrip();
  if (!trip || isTripExpired(trip)) return null;
  return trip;
}

export function clearTrip() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function isTripExpired(trip: StoredTrip): boolean {
  return Date.now() > trip.expiresAt;
}

export function isTripCompleted(
  trip: StoredTrip,
  coords: { lat: number; lng: number } | null,
): boolean {
  if (!coords) return false;
  const d = haversineMeters(coords, { lat: trip.destination.lat, lng: trip.destination.lng });
  return d < 350;
}

export function tripStillActive(
  trip: StoredTrip,
  coords: { lat: number; lng: number } | null,
): boolean {
  if (isTripExpired(trip)) return false;
  if (isTripCompleted(trip, coords)) return false;
  return true;
}

export function createTripExpiry(durationSeconds: number): number {
  const buffer = Math.max(durationSeconds * 1.25, durationSeconds + 900);
  return Date.now() + buffer * 1000;
}

export function addReportToTrip(tripId: string, reportId: string) {
  const trip = loadTrip();
  if (!trip || trip.tripId !== tripId) return;
  if (!trip.reportIds.includes(reportId)) {
    trip.reportIds.push(reportId);
    saveTrip(trip);
  }
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
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
