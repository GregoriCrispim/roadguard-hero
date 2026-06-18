export type LatLng = { lat: number; lng: number };

export type ConcessionariaPedagio = {
  id: string;
  concessionaria_id: string;
  nome: string;
  km: string | null;
  latitude: number;
  longitude: number;
  preco_carro_centavos: number;
  sentido: string | null;
  raio_metros: number;
};

export type ConcessionariaRota = {
  id: string;
  concessionaria_id: string;
  nome: string;
  coordinates: [number, number][];
  buffer_metros: number;
};

export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Distância mínima de um ponto à polilinha (segmentos). */
export function distanceToPolylineMeters(
  point: LatLng,
  polyline: [number, number][],
): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    return haversineMeters(point, { lat: polyline[0][0], lng: polyline[0][1] });
  }

  let best = Infinity;
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
    best = Math.min(best, haversineMeters(point, { lat, lng }));
  }
  return best;
}

export function pointInConcessionariaScope(
  lat: number,
  lng: number,
  rotas: ConcessionariaRota[],
  pedagios: ConcessionariaPedagio[],
): boolean {
  const point = { lat, lng };

  for (const rota of rotas) {
    const coords = normalizeCoordinates(rota.coordinates);
    if (coords.length >= 2) {
      const dist = distanceToPolylineMeters(point, coords);
      if (dist <= rota.buffer_metros) return true;
    }
  }

  for (const p of pedagios) {
    const dist = haversineMeters(point, { lat: p.latitude, lng: p.longitude });
    if (dist <= p.raio_metros) return true;
  }

  return false;
}

export function findConcessionariaForPoint(
  lat: number,
  lng: number,
  configs: {
    concessionaria_id: string;
    rotas: ConcessionariaRota[];
    pedagios: ConcessionariaPedagio[];
  }[],
): string | null {
  for (const cfg of configs) {
    if (pointInConcessionariaScope(lat, lng, cfg.rotas, cfg.pedagios)) {
      return cfg.concessionaria_id;
    }
  }
  return null;
}

export function normalizeCoordinates(raw: unknown): [number, number][] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((c) => Array.isArray(c) && c.length >= 2)
    .map((c) => [Number(c[0]), Number(c[1])] as [number, number])
    .filter(([la, ln]) => Number.isFinite(la) && Number.isFinite(ln));
}

export function filterReportsInScope<T extends { latitude: number; longitude: number; concessionaria_id?: string | null }>(
  reports: T[],
  concessionariaId: string,
  rotas: ConcessionariaRota[],
  pedagios: ConcessionariaPedagio[],
): T[] {
  return reports.filter((r) => {
    if (r.concessionaria_id === concessionariaId) return true;
    return pointInConcessionariaScope(r.latitude, r.longitude, rotas, pedagios);
  });
}
