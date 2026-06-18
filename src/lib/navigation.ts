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

export function distanceBetweenMeters(a: LatLng, b: LatLng): number {
  return haversineMeters(a, b);
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

export function offRouteDistanceMeters(
  position: LatLng,
  coordinates: [number, number][],
): number {
  if (coordinates.length < 2) return 0;

  let bestDist = Infinity;
  for (let i = 0; i < coordinates.length - 1; i++) {
    const [lat1, lng1] = coordinates[i];
    const [lat2, lng2] = coordinates[i + 1];
    const { distance } = distancePointToSegmentMeters(
      position,
      { lat: lat1, lng: lng1 },
      { lat: lat2, lng: lng2 },
    );
    bestDist = Math.min(bestDist, distance);
  }
  return bestDist;
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

function closestRouteSegment(
  position: LatLng,
  coordinates: [number, number][],
): { index: number; t: number; point: LatLng } {
  if (coordinates.length < 2) {
    return { index: 0, t: 0, point: position };
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

  const [cLat, cLng] = coordinates[bestIndex];
  const [nLat, nLng] = coordinates[bestIndex + 1];
  return {
    index: bestIndex,
    t: bestT,
    point: {
      lat: cLat + bestT * (nLat - cLat),
      lng: cLng + bestT * (nLng - cLng),
    },
  };
}

/** Direção da rota à frente do usuário (para rotação do mapa). */
export function bearingAlongRoute(
  position: LatLng,
  coordinates: [number, number][],
  lookaheadMeters = 45,
): number {
  if (coordinates.length < 2) return 0;

  const { index, t, point } = closestRouteSegment(position, coordinates);
  let remaining = lookaheadMeters;
  let lat = point.lat;
  let lng = point.lng;

  const [nLat0, nLng0] = coordinates[index + 1];
  const seg0 = haversineMeters({ lat, lng }, { lat: nLat0, lng: nLng0 });
  const distOnSeg0 = seg0 * (1 - t);

  if (distOnSeg0 >= remaining) {
    const ratio = remaining / Math.max(distOnSeg0, 1);
    return bearingBetween(position, {
      lat: lat + (nLat0 - lat) * ratio,
      lng: lng + (nLng0 - lng) * ratio,
    });
  }

  remaining -= distOnSeg0;
  lat = nLat0;
  lng = nLng0;

  for (let i = index + 1; i < coordinates.length - 1; i++) {
    const [lat2, lng2] = coordinates[i + 1];
    const seg = haversineMeters({ lat, lng }, { lat: lat2, lng: lng2 });
    if (seg >= remaining) {
      const ratio = remaining / Math.max(seg, 1);
      return bearingBetween(position, {
        lat: lat + (lat2 - lat) * ratio,
        lng: lng + (lng2 - lng) * ratio,
      });
    }
    remaining -= seg;
    lat = lat2;
    lng = lng2;
  }

  const last = coordinates[coordinates.length - 1];
  return bearingBetween(position, { lat: last[0], lng: last[1] });
}

export function smoothBearing(current: number, target: number, factor = 0.12): number {
  const diff = ((target - current + 540) % 360) - 180;
  return (current + diff * factor + 360) % 360;
}

export type NavigationCue = {
  distanceMeters: number;
  instruction: string;
  bearing: number;
};

function turnDirection(delta: number): string {
  if (delta > 25 && delta < 155) return "Vire à direita";
  if (delta < -25 && delta > -155) return "Vire à esquerda";
  if (Math.abs(delta) >= 155) return "Faça o retorno";
  return "Siga em frente";
}

/** Próxima manobra ou trecho reto (estilo Waze). */
export function nextNavigationCue(
  position: LatLng,
  coordinates: [number, number][],
): NavigationCue {
  if (coordinates.length < 2) {
    return { distanceMeters: 0, instruction: "Siga em frente", bearing: 0 };
  }

  const { index, t, point } = closestRouteSegment(position, coordinates);
  const bearing = bearingAlongRoute(position, coordinates);

  let walked = haversineMeters(point, {
    lat: coordinates[index + 1][0],
    lng: coordinates[index + 1][1],
  }) * (1 - t);

  let prevBearing = bearingBetween(
    { lat: coordinates[index][0], lng: coordinates[index][1] },
    { lat: coordinates[index + 1][0], lng: coordinates[index + 1][1] },
  );

  for (let i = index + 1; i < coordinates.length - 1; i++) {
    const [lat1, lng1] = coordinates[i];
    const [lat2, lng2] = coordinates[i + 1];
    const segBearing = bearingBetween({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });
    const segLen = haversineMeters({ lat: lat1, lng: lng1 }, { lat: lat2, lng: lng2 });

    let delta = segBearing - prevBearing;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    if (Math.abs(delta) >= 22 && walked > 35) {
      return {
        distanceMeters: Math.round(walked),
        instruction: turnDirection(delta),
        bearing: segBearing,
      };
    }

    if (i + 1 < coordinates.length - 1) {
      const [lat3, lng3] = coordinates[i + 2];
      const nextBearing = bearingBetween({ lat: lat2, lng: lng2 }, { lat: lat3, lng: lng3 });
      let turn = nextBearing - segBearing;
      if (turn > 180) turn -= 360;
      if (turn < -180) turn += 360;

      if (Math.abs(turn) >= 22) {
        return {
          distanceMeters: Math.round(walked + segLen),
          instruction: turnDirection(turn),
          bearing: nextBearing,
        };
      }
    }

    walked += segLen;
    prevBearing = segBearing;
  }

  const dest = coordinates[coordinates.length - 1];
  return {
    distanceMeters: Math.round(
      haversineMeters(position, { lat: dest[0], lng: dest[1] }),
    ),
    instruction: "Siga até o destino",
    bearing,
  };
}

export function navigationHeading(
  position: LatLng,
  coordinates: [number, number][],
  gpsHeading: number | null,
  speedKmh: number | null,
): number {
  const routeBearing = bearingAlongRoute(position, coordinates);
  if (
    gpsHeading != null &&
    !Number.isNaN(gpsHeading) &&
    gpsHeading >= 0 &&
    speedKmh != null &&
    speedKmh > 8
  ) {
    return gpsHeading;
  }
  return routeBearing;
}

/** Bearing para rotação do mapa — sempre alinha a rota à direção do cursor. */
export function mapRotationBearing(
  position: LatLng,
  coordinates: [number, number][],
): number {
  if (coordinates.length < 2) return 0;
  return bearingAlongRoute(position, coordinates, 60);
}
