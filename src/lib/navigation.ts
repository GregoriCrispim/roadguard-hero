import type { LatLng } from "@/lib/routing";

export type NavigationStats = {
  remainingMeters: number;
  remainingSeconds: number;
  arrivalTime: string;
  progress: number;
};

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

function distancePointToSegmentMeters(
  point: LatLng,
  a: LatLng,
  b: LatLng,
): { distance: number; t: number } {
  const latMid = (a.lat + b.lat) / 2;
  const cosLat = Math.cos((latMid * Math.PI) / 180);
  const ax = a.lng * cosLat;
  const ay = a.lat;
  const bx = b.lng * cosLat;
  const by = b.lat;
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

  const closest = { lat: ay + t * dy, lng: (ax + t * dx) / cosLat };
  return { distance: haversineMeters(point, closest), t };
}

export function remainingAlongRoute(
  position: LatLng,
  coordinates: [number, number][],
): { remainingMeters: number; progress: number } {
  if (coordinates.length < 2) {
    return { remainingMeters: 0, progress: 1 };
  }

  let bestDist = Infinity;
  let bestIndex = 0;
  let bestT = 0;

  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lat1, lng1] = coordinates[i];
    const [lat2, lng2] = coordinates[i + 1];
    const { distance, t } = distancePointToSegmentMeters(
      position,
      { lat: lat1, lng: lng1 },
      { lat: lat2, lng: lng2 },
    );
    if (distance < bestDist) {
      bestDist = distance;
      bestIndex = i;
      bestT = t;
    }
  }

  let remaining = 0;
  const [cLat, cLng] = coordinates[bestIndex];
  const [nLat, nLng] = coordinates[bestIndex + 1];
  remaining += haversineMeters(position, {
    lat: cLat + bestT * (nLat - cLat),
    lng: cLng + bestT * (nLng - cLng),
  });

  for (let i = bestIndex + 1; i < coordinates.length - 1; i++) {
    const [lat1, lng1] = coordinates[i];
    const [lat2, lng2] = coordinates[i + 1];
    remaining += haversineMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
  }

  const total = coordinates.reduce((sum, coord, i) => {
    if (i === 0) return 0;
    const [lat1, lng1] = coordinates[i - 1];
    const [lat2, lng2] = coord;
    return sum + haversineMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
  }, 0);

  const progress = total > 0 ? Math.max(0, Math.min(1, 1 - remaining / total)) : 0;
  return { remainingMeters: remaining, progress };
}

export function estimateRemainingSeconds(
  remainingMeters: number,
  routeDistanceMeters: number,
  routeDurationSeconds: number,
  speedMps: number | null,
): number {
  if (remainingMeters <= 0) return 0;

  const routeAvg = routeDistanceMeters > 0 ? routeDistanceMeters / routeDurationSeconds : 0;
  const speed = speedMps != null && speedMps > 1.5 ? speedMps : routeAvg || 8;
  return remainingMeters / speed;
}

export function formatArrivalTime(remainingSeconds: number): string {
  const arrival = new Date(Date.now() + remainingSeconds * 1000);
  return arrival.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export function computeNavigationStats(
  position: LatLng,
  route: { distanceMeters: number; durationSeconds: number; coordinates: [number, number][] },
  speedMps: number | null,
  destination?: LatLng | null,
): NavigationStats {
  const { remainingMeters, progress } =
    route.coordinates.length >= 2
      ? remainingAlongRoute(position, route.coordinates)
      : {
          remainingMeters: destination
            ? haversineMeters(position, destination)
            : route.distanceMeters,
          progress: 0,
        };

  const remainingSeconds = estimateRemainingSeconds(
    remainingMeters,
    route.distanceMeters,
    route.durationSeconds,
    speedMps,
  );

  return {
    remainingMeters: Math.max(0, remainingMeters),
    remainingSeconds: Math.max(0, remainingSeconds),
    arrivalTime: formatArrivalTime(remainingSeconds),
    progress,
  };
}

export function bearingBetween(a: LatLng, b: LatLng): number {
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
