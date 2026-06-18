export const REPORT_RATE_LIMITS = {
  maxInTimeWindow: 3,
  timeWindowMs: 2 * 60 * 1000,
  maxInRadius: 3,
  radiusMeters: 100,
  radiusTimeWindowMs: 2 * 60 * 1000,
} as const;

export type ReportForRateLimit = {
  latitude: number;
  longitude: number;
  created_at: string;
};

export type RateLimitViolation = "time" | "radius";

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; violation: RateLimitViolation; message: string };

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function checkReportRateLimit(
  reports: ReportForRateLimit[],
  lat: number,
  lng: number,
  now = Date.now(),
): RateLimitResult {
  const { maxInTimeWindow, timeWindowMs, maxInRadius, radiusMeters, radiusTimeWindowMs } =
    REPORT_RATE_LIMITS;

  const inTimeWindow = reports.filter(
    (r) => now - new Date(r.created_at).getTime() < timeWindowMs,
  );
  if (inTimeWindow.length >= maxInTimeWindow) {
    return {
      allowed: false,
      violation: "time",
      message: "Limite atingido: no máximo 3 reportes a cada 2 minutos. Aguarde um pouco.",
    };
  }

  const inRadius = reports.filter((r) => {
    const age = now - new Date(r.created_at).getTime();
    if (age >= radiusTimeWindowMs) return false;
    return haversineMeters(lat, lng, r.latitude, r.longitude) <= radiusMeters;
  });
  if (inRadius.length >= maxInRadius) {
    return {
      allowed: false,
      violation: "radius",
      message: "Limite atingido: no máximo 3 reportes num raio de 100 metros.",
    };
  }

  return { allowed: true };
}
