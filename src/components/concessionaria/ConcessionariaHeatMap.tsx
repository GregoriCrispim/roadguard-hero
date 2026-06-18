import { useEffect, useRef } from "react";
import type { ReportRow } from "@/lib/concessionaria-stats";
import { heatmapPoints } from "@/lib/concessionaria-stats";
import { CATEGORIAS, type CategoriaKey } from "@/lib/categorias";
import { GRAVIDADE_COR } from "@/lib/categorias";

type Props = {
  reports: ReportRow[];
  mode?: "heat" | "markers";
};

export function ConcessionariaHeatMap({ reports, mode = "heat" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let map: import("leaflet").Map | undefined;
    let heatLayer: import("leaflet").Layer | undefined;

    (async () => {
      if (!ref.current || !reports.length) return;
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (map) map.remove();
      ref.current.innerHTML = "";

      const centerLat = reports.reduce((s, r) => s + r.latitude, 0) / reports.length;
      const centerLng = reports.reduce((s, r) => s + r.longitude, 0) / reports.length;

      map = L.map(ref.current).setView([centerLat, centerLng], 7);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);

      if (mode === "heat") {
        await import("leaflet.heat");
        const points = heatmapPoints(reports);
        heatLayer = (L as typeof L & { heatLayer: (p: [number, number, number][], o?: object) => import("leaflet").Layer }).heatLayer(points, {
          radius: 28,
          blur: 22,
          maxZoom: 12,
          gradient: {
            0.2: "#005A9C",
            0.4: "#22C55E",
            0.6: "#F59E0B",
            0.8: "#EA580C",
            1.0: "#DC2626",
          },
        });
        heatLayer.addTo(map);
      }

      reports.forEach((r) => {
        const cat = CATEGORIAS[r.categoria as CategoriaKey];
        const color = r.gravidade ? GRAVIDADE_COR[r.gravidade] : cat?.cor ?? "#64748B";
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:${mode === "heat" ? 10 : 14}px;height:${mode === "heat" ? 10 : 14}px;border-radius:50%;background:${color};border:1.5px solid white;box-shadow:0 1px 4px rgba(0,0,0,.35);opacity:${mode === "heat" ? 0.85 : 1}"></div>`,
        });
        L.marker([r.latitude, r.longitude], { icon })
          .addTo(map!)
          .bindPopup(
            `<b>${cat?.label ?? r.categoria}</b><br/>${r.descricao ?? "Sem descrição"}<br/><small>${r.gravidade ?? "—"} · ${r.status}</small>`,
          );
      });

      const bounds = L.latLngBounds(reports.map((r) => [r.latitude, r.longitude] as [number, number]));
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.15));
    })();

    return () => {
      if (map) map.remove();
    };
  }, [reports, mode]);

  if (!reports.length) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-2xl border bg-muted/30 text-sm text-muted-foreground">
        Nenhuma ocorrência para exibir no mapa.
      </div>
    );
  }

  return <div ref={ref} className="h-[420px] w-full overflow-hidden rounded-2xl border" />;
}
