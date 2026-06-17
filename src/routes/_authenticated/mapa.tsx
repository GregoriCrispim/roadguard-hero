import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useRef, useState } from "react";
import { CATEGORIAS, CATEGORIAS_LIST, type CategoriaKey } from "@/lib/categorias";

export const Route = createFileRoute("/_authenticated/mapa")({
  component: MapaPage,
});

function MapaPage() {
  const [filtro, setFiltro] = useState<CategoriaKey | "todas">("todas");
  const { data: reports } = useQuery({
    queryKey: ["reports-all"],
    queryFn: async () => {
      const { data } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(500);
      return data ?? [];
    },
  });

  const filtered = (reports ?? []).filter((r) => filtro === "todas" || r.categoria === filtro);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold">Mapa ao vivo</h1>
        <p className="text-muted-foreground">{filtered.length} ocorrências recentes</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setFiltro("todas")} className={`rounded-full px-3 py-1 text-xs ${filtro === "todas" ? "bg-primary text-primary-foreground" : "bg-surface"}`}>Todas</button>
        {CATEGORIAS_LIST.map((c) => (
          <button key={c.key} onClick={() => setFiltro(c.key)} className={`rounded-full px-3 py-1 text-xs ${filtro === c.key ? "bg-primary text-primary-foreground" : "bg-surface"}`}>{c.label}</button>
        ))}
      </div>
      <ClientMap reports={filtered} />
    </div>
  );
}

function ClientMap({ reports }: { reports: any[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let map: any;
    (async () => {
      if (typeof window === "undefined" || !ref.current) return;
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");
      map = L.map(ref.current).setView([-15.78, -47.93], 4);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
      }).addTo(map);
      reports.forEach((r) => {
        const c = CATEGORIAS[r.categoria as CategoriaKey];
        const icon = L.divIcon({
          className: "",
          html: `<div style="width:24px;height:24px;border-radius:50%;background:${c?.cor ?? "#22C55E"};border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>`,
        });
        L.marker([r.latitude, r.longitude], { icon })
          .addTo(map)
          .bindPopup(`<b>${c?.label}</b><br/>${r.descricao ?? ""}<br/><small>${r.gravidade ?? "em análise"}</small>`);
      });
      setReady(true);
    })();
    return () => { if (map) map.remove(); };
  }, [reports]);

  return (
    <div className="overflow-hidden rounded-2xl border" style={{ height: "70vh" }}>
      <div ref={ref} className="h-full w-full" />
      {!ready && <div className="p-6 text-sm text-muted-foreground">Carregando mapa...</div>}
    </div>
  );
}