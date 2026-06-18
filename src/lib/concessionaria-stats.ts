import type { Database } from "@/integrations/supabase/types";
import { CATEGORIAS, type CategoriaKey } from "@/lib/categorias";

export type ReportRow = Database["public"]["Tables"]["reports"]["Row"];

const MS_DAY = 86_400_000;
const MS_HOUR = 3_600_000;

export function reportsLast24h(reports: ReportRow[]): number {
  const cutoff = Date.now() - MS_DAY;
  return reports.filter((r) => new Date(r.created_at).getTime() >= cutoff).length;
}

export function reportsLast7d(reports: ReportRow[]): number {
  const cutoff = Date.now() - 7 * MS_DAY;
  return reports.filter((r) => new Date(r.created_at).getTime() >= cutoff).length;
}

export function countByStatus(reports: ReportRow[]) {
  return reports.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
}

export function countByCategory(reports: ReportRow[]) {
  return Object.entries(
    reports.reduce<Record<string, number>>((acc, r) => {
      acc[r.categoria] = (acc[r.categoria] ?? 0) + 1;
      return acc;
    }, {}),
  ).map(([key, value]) => ({
    key,
    name: CATEGORIAS[key as CategoriaKey]?.label ?? key,
    value,
    fill: CATEGORIAS[key as CategoriaKey]?.cor ?? "#64748B",
  }));
}

export function countBySeverity(reports: ReportRow[]) {
  return ["baixa", "media", "alta", "critica"].map((g) => ({
    name: g,
    value: reports.filter((r) => r.gravidade === g).length,
    fill: { baixa: "#4CAF50", media: "#F59E0B", alta: "#EA580C", critica: "#DC2626" }[g],
  }));
}

export function uniqueReporters(reports: ReportRow[]): number {
  return new Set(reports.map((r) => r.user_id)).size;
}

export function avgAiScore(reports: ReportRow[]): number | null {
  const scored = reports.filter((r) => r.score_ia != null);
  if (!scored.length) return null;
  const sum = scored.reduce((a, r) => a + Number(r.score_ia), 0);
  return +(sum / scored.length).toFixed(2);
}

export function resolutionRate(reports: ReportRow[]): number {
  const closed = reports.filter((r) => r.status === "resolvido").length;
  const actionable = reports.filter((r) => r.status === "validado" || r.status === "resolvido").length;
  if (!actionable) return 0;
  return Math.round((closed / actionable) * 100);
}

export function criticalOpen(reports: ReportRow[]): number {
  return reports.filter(
    (r) => r.gravidade === "critica" && r.status !== "resolvido" && r.status !== "descartado",
  ).length;
}

export function pendingValidation(reports: ReportRow[]): number {
  return reports.filter((r) => r.status === "em_analise").length;
}

export function dailyTrend(reports: ReportRow[], days = 14) {
  const buckets: { date: string; label: string; total: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.push({
      date: key,
      label: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      total: 0,
    });
  }
  for (const r of reports) {
    const key = r.created_at.slice(0, 10);
    const bucket = buckets.find((b) => b.date === key);
    if (bucket) bucket.total += 1;
  }
  return buckets;
}

export function hourlyDistribution(reports: ReportRow[]) {
  return Array.from({ length: 24 }, (_, hour) => ({
    hour: `${hour}h`,
    total: reports.filter((r) => new Date(r.created_at).getHours() === hour).length,
  }));
}

export function avgResolutionMinutes(reports: ReportRow[]): number | null {
  const resolved = reports.filter((r) => r.status === "resolvido");
  if (!resolved.length) return null;
  const totalMs = resolved.reduce((acc, r) => {
    return acc + (new Date(r.updated_at).getTime() - new Date(r.created_at).getTime());
  }, 0);
  return Math.round(totalMs / resolved.length / MS_HOUR * 60);
}

export type Hotspot = {
  lat: number;
  lng: number;
  count: number;
  label: string;
  categories: string[];
};

/** Agrupa ocorrências em células ~1,1 km para identificar pontos críticos recorrentes. */
export function computeHotspots(reports: ReportRow[], minCount = 2): Hotspot[] {
  const grid = new Map<string, { lat: number; lng: number; count: number; categories: Set<string> }>();

  for (const r of reports) {
    const lat = Math.round(r.latitude * 100) / 100;
    const lng = Math.round(r.longitude * 100) / 100;
    const key = `${lat},${lng}`;
    const cell = grid.get(key) ?? { lat, lng, count: 0, categories: new Set<string>() };
    cell.count += 1;
    cell.categories.add(r.categoria);
    grid.set(key, cell);
  }

  return [...grid.values()]
    .filter((c) => c.count >= minCount)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((c) => ({
      lat: c.lat,
      lng: c.lng,
      count: c.count,
      label: `${c.lat.toFixed(2)}, ${c.lng.toFixed(2)}`,
      categories: [...c.categories],
    }));
}

export function heatmapPoints(reports: ReportRow[]): [number, number, number][] {
  return reports.map((r) => {
    const weight =
      r.gravidade === "critica" ? 1 : r.gravidade === "alta" ? 0.8 : r.gravidade === "media" ? 0.5 : 0.3;
    return [r.latitude, r.longitude, weight] as [number, number, number];
  });
}

export function statusFunnel(reports: ReportRow[]) {
  const counts = countByStatus(reports);
  return [
    { stage: "Em análise", value: counts.em_analise ?? 0 },
    { stage: "Validados", value: counts.validado ?? 0 },
    { stage: "Resolvidos", value: counts.resolvido ?? 0 },
    { stage: "Descartados", value: counts.descartado ?? 0 },
  ];
}

export function exportReportsCsv(reports: ReportRow[]) {
  const headers = [
    "id", "categoria", "gravidade", "status", "descricao", "score_ia",
    "latitude", "longitude", "user_id", "created_at", "updated_at",
  ];
  const rows = reports.map((r) =>
    headers.map((h) => {
      const v = String((r as Record<string, unknown>)[h] ?? "");
      return v.includes(",") ? `"${v.replace(/"/g, '""')}"` : v;
    }).join(","),
  );
  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `roadhero-concessionaria-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
