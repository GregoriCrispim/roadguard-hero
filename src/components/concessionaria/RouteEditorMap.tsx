import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

type Props = {
  coordinates: [number, number][];
  pedagios?: { lat: number; lng: number; nome: string }[];
  onChange: (coords: [number, number][]) => void;
  readOnly?: boolean;
};

export function RouteEditorMap({ coordinates, pedagios = [], onChange, readOnly }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("leaflet").Map | null>(null);
  const layerRef = useRef<import("leaflet").LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ref.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled) return;
      if (mapRef.current) mapRef.current.remove();

      const map = L.map(ref.current).setView([-15.78, -47.93], 5);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      const layer = L.layerGroup().addTo(map);
      mapRef.current = map;
      layerRef.current = layer;
      setReady(true);

      if (!readOnly) {
        map.on("click", (e: import("leaflet").LeafletMouseEvent) => {
          onChange([...coordinates, [e.latlng.lat, e.latlng.lng]]);
        });
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [readOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!ready || !mapRef.current || !layerRef.current) return;
    const map = mapRef.current;
    const layer = layerRef.current;

    void (async () => {
      const L = (await import("leaflet")).default;
      layer.clearLayers();

      pedagios.forEach((p) => {
        L.circleMarker([p.lat, p.lng], { radius: 6, color: "#005A9C", fillColor: "#005A9C", fillOpacity: 0.8 })
          .addTo(layer)
          .bindPopup(p.nome);
      });

      if (coordinates.length > 0) {
        coordinates.forEach(([lat, lng], i) => {
          L.circleMarker([lat, lng], { radius: 5, color: "#DC2626", fillColor: "#DC2626", fillOpacity: 0.9 })
            .addTo(layer)
            .bindPopup(`Ponto ${i + 1}`);
        });
        if (coordinates.length >= 2) {
          L.polyline(coordinates, { color: "#DC2626", weight: 4, opacity: 0.85 }).addTo(layer);
          map.fitBounds(L.latLngBounds(coordinates), { padding: [40, 40] });
        } else {
          map.setView(coordinates[0], 10);
        }
      }
    })();
  }, [coordinates, pedagios, ready]);

  return (
    <div className="space-y-2">
      <div ref={ref} className="h-[360px] w-full overflow-hidden rounded-xl border" />
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => onChange(coordinates.slice(0, -1))} disabled={!coordinates.length}>
            Desfazer ponto
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange([])} disabled={!coordinates.length}>
            <Trash2 className="mr-1 h-3.5 w-3.5" /> Limpar rota
          </Button>
          <p className="text-xs text-muted-foreground self-center">
            Clique no mapa para adicionar pontos do trecho pedagiado ({coordinates.length} pontos).
          </p>
        </div>
      )}
    </div>
  );
}
