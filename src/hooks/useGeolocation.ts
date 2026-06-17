import { useCallback, useEffect, useRef, useState } from "react";

export type GeoCoords = {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  accuracy: number | null;
};

const DEFAULT_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 500,
  timeout: 15000,
};

export function useGeolocation(options: PositionOptions = DEFAULT_OPTIONS) {
  const [position, setPosition] = useState<GeolocationPosition | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tracking, setTracking] = useState(false);
  const watchId = useRef<number | null>(null);

  const stop = useCallback(() => {
    if (watchId.current != null) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    setTracking(false);
  }, []);

  const start = useCallback(() => {
    if (!navigator.geolocation) {
      setError("GPS indisponível neste dispositivo");
      return;
    }

    stop();
    watchId.current = navigator.geolocation.watchPosition(
      (p) => {
        setPosition(p);
        setError(null);
      },
      (e) => setError(e.message || "Não foi possível obter localização"),
      options,
    );
    setTracking(true);
  }, [options, stop]);

  useEffect(() => () => stop(), [stop]);

  const coords: GeoCoords | null = position
    ? {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        heading: position.coords.heading,
        speed: position.coords.speed,
        accuracy: position.coords.accuracy,
      }
    : null;

  return { position, coords, error, tracking, start, stop };
}
