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
};

/** Praças de pedágio aproximadas em rodovias brasileiras (valores referência carro) */
const TOLL_PLAZAS: TollPlaza[] = [
  { id: "sp-imigrantes", name: "Imigrantes", highway: "SP-160", lat: -23.8512, lng: -46.7185, priceCarCents: 3420 },
  { id: "sp-anchieta", name: "Anchieta", highway: "SP-150", lat: -23.912, lng: -46.389, priceCarCents: 2890 },
  { id: "sp-castelo", name: "Castelo Branco", highway: "SP-280", lat: -23.452, lng: -46.876, priceCarCents: 3150 },
  { id: "sp-band", name: "Bandeirantes", highway: "SP-348", lat: -23.012, lng: -47.134, priceCarCents: 2780 },
  { id: "sp-raposo", name: "Raposo Tavares", highway: "SP-270", lat: -23.589, lng: -46.752, priceCarCents: 2540 },
  { id: "rj-arcored", name: "Arco Redentor", highway: "BR-101", lat: -22.903, lng: -43.178, priceCarCents: 1890 },
  { id: "rj-teresopolis", name: "Teresópolis", highway: "BR-116", lat: -22.412, lng: -42.965, priceCarCents: 2240 },
  { id: "mg-bh-rio", name: "Conceição do Mato Dentro", highway: "BR-381", lat: -19.032, lng: -43.425, priceCarCents: 3680 },
  { id: "mg-contagem", name: "Contagem", highway: "BR-381", lat: -19.945, lng: -44.052, priceCarCents: 2120 },
  { id: "pr-curitiba", name: "Curitiba", highway: "BR-116", lat: -25.428, lng: -49.273, priceCarCents: 1950 },
  { id: "pr-litoral", name: "Litoral Paranaense", highway: "BR-277", lat: -25.542, lng: -48.512, priceCarCents: 1680 },
  { id: "sc-florianopolis", name: "Florianópolis", highway: "BR-101", lat: -27.595, lng: -48.548, priceCarCents: 1780 },
  { id: "rs-porto", name: "Porto Alegre", highway: "BR-116", lat: -30.034, lng: -51.217, priceCarCents: 2050 },
  { id: "ba-salvador", name: "Salvador", highway: "BR-324", lat: -12.971, lng: -38.501, priceCarCents: 1920 },
  { id: "df-brasilia", name: "Brasília Sul", highway: "BR-040", lat: -15.839, lng: -47.923, priceCarCents: 1560 },
  { id: "go-anapolis", name: "Anápolis", highway: "BR-060", lat: -16.328, lng: -48.953, priceCarCents: 1420 },
  { id: "es-vitoria", name: "Vitória", highway: "BR-101", lat: -20.315, lng: -40.312, priceCarCents: 1650 },
];

const PROXIMITY_METERS = 1200;

function pointToSegmentDistanceMeters(
  p: LatLng,
  a: LatLng,
  b: LatLng,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const lng1 = toRad(a.lng);
  const lng2 = toRad(b.lng);
  const plat = toRad(p.lat);
  const plng = toRad(p.lng);

  const x = (lng2 - lng1) * Math.cos((lat1 + lat2) / 2);
  const y = lat2 - lat1;
  const len2 = x * x + y * y;
  if (len2 === 0) return haversineMeters(p, a);

  let t = ((plng - lng1) * x + (plat - lat1) * y) / len2;
  t = Math.max(0, Math.min(1, t));
  const proj = {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
  };
  return haversineMeters(p, proj);
}

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

function distanceToPolylineMeters(point: LatLng, polyline: [number, number][]): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) return haversineMeters(point, { lat: polyline[0][0], lng: polyline[0][1] });

  let min = Infinity;
  for (let i = 0; i < polyline.length - 1; i++) {
    const a = { lat: polyline[i][0], lng: polyline[i][1] };
    const b = { lat: polyline[i + 1][0], lng: polyline[i + 1][1] };
    min = Math.min(min, pointToSegmentDistanceMeters(point, a, b));
  }
  return min;
}

export function calculateTollsAlongRoute(coordinates: [number, number][]): {
  tolls: TollOnRoute[];
  totalCents: number;
} {
  const found: TollOnRoute[] = [];

  for (const plaza of TOLL_PLAZAS) {
    const dist = distanceToPolylineMeters({ lat: plaza.lat, lng: plaza.lng }, coordinates);
    if (dist <= PROXIMITY_METERS) {
      found.push({
        id: plaza.id,
        name: plaza.name,
        highway: plaza.highway,
        priceCarCents: plaza.priceCarCents,
      });
    }
  }

  const totalCents = found.reduce((s, t) => s + t.priceCarCents, 0);
  return { tolls: found, totalCents };
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
