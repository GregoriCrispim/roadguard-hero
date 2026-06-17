import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { CATEGORIAS, GRAVIDADE_COR } from "@/lib/categorias";
import { Building2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/admin")({ component: Admin });

function Admin() {
  const { data: reports } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => (await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(1000)).data ?? [],
  });
  const { data: users } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => (await supabase.from("profiles").select("id, pontos")).data ?? [],
  });

  const total = reports?.length ?? 0;
  const porCat = Object.entries(
    (reports ?? []).reduce<Record<string, number>>((a, r) => ({ ...a, [r.categoria]: (a[r.categoria] ?? 0) + 1 }), {}),
  ).map(([k, v]) => ({ name: CATEGORIAS[k as keyof typeof CATEGORIAS]?.label ?? k, value: v, fill: CATEGORIAS[k as keyof typeof CATEGORIAS]?.cor }));
  const porGrav = ["baixa", "media", "alta", "critica"].map((g) => ({
    name: g, value: (reports ?? []).filter((r) => r.gravidade === g).length, fill: GRAVIDADE_COR[g],
  }));

  function exportarCSV() {
    if (!reports?.length) return;
    const headers = ["id", "categoria", "gravidade", "status", "latitude", "longitude", "created_at"];
    const rows = reports.map((r) => headers.map((h) => (r as any)[h] ?? "").join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `roadhero-${Date.now()}.csv`; a.click();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-7 w-7 text-accent" />
          <div>
            <h1 className="font-display text-3xl font-bold">Painel Concessionária</h1>
            <p className="text-muted-foreground">Visão consolidada do programa Guardião.</p>
          </div>
        </div>
        <Button onClick={exportarCSV} variant="outline" className="gap-2"><Download className="h-4 w-4" /> CSV</Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { l: "Ocorrências totais", v: total },
          { l: "Usuários ativos", v: users?.length ?? 0 },
          { l: "Críticas", v: (reports ?? []).filter((r) => r.gravidade === "critica").length },
          { l: "Pontos distribuídos", v: (users ?? []).reduce((a, u) => a + (u.pontos ?? 0), 0).toLocaleString("pt-BR") },
        ].map((m) => (
          <div key={m.l} className="rounded-2xl border bg-card p-5">
            <p className="text-xs text-muted-foreground">{m.l}</p>
            <p className="mt-1 font-display text-3xl font-bold text-primary">{m.v}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="mb-4 font-display text-lg font-bold">Por categoria</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porCat}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              <Bar dataKey="value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="mb-4 font-display text-lg font-bold">Por gravidade</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porGrav} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                {porGrav.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}