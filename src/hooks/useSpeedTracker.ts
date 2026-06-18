import { useEffect, useRef, useState } from "react";
import { distanceBetweenMeters } from "@/lib/navigation";
import type { GeoCoords } from "@/hooks/useGeolocation";

type Sample = { t: number; lat: number; lng: number };

export function useSpeedTracker(coords: GeoCoords | null): number | null {
  const [speedKmh, setSpeedKmh] = useState<number | null>(null);
  const samplesRef = useRef<Sample[]>([]);

  useEffect(() => {
    if (!coords) {
      setSpeedKmh(null);
      return;
    }

    const now = Date.now();
    samplesRef.current.push({ t: now, lat: coords.lat, lng: coords.lng });
    samplesRef.current = samplesRef.current.filter((s) => now - s.t <= 12_000);

    if (coords.speed != null && coords.speed >= 0 && Number.isFinite(coords.speed)) {
      setSpeedKmh(Math.max(0, coords.speed * 3.6));
      return;
    }

    const samples = samplesRef.current;
    if (samples.length < 2) return;

    const oldest = samples[0];
    const newest = samples[samples.length - 1];
    const dt = (newest.t - oldest.t) / 1000;
    if (dt < 0.8) return;

    const meters = distanceBetweenMeters(oldest, newest);
    setSpeedKmh(Math.max(0, (meters / dt) * 3.6));
  }, [coords?.lat, coords?.lng, coords?.speed]);

  return speedKmh;
}
