import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConcessionariaMembership, useConcessionariaScope, useIsConcessionaria } from "@/hooks/useUserRole";
import { AlertsPanel } from "@/components/concessionaria/AlertsPanel";
import { ConcessionariaConfig } from "@/components/concessionaria/ConcessionariaConfig";
import { ConcessionariaHeatMap } from "@/components/concessionaria/ConcessionariaHeatMap";
import { filterReportsInScope } from "@/lib/geo-scope";
import {
  avgAiScore,
  avgResolutionMinutes,
  computeHotspots,
  countBySeverity,
  countByCategory,
  countByStatus,
  criticalOpen,
  dailyTrend,
  exportReportsCsv,
  hourlyDistribution,
  pendingValidation,
  reportsLast24h,
  reportsLast7d,
  resolutionRate,
  statusFunnel,
  uniqueReporters,
} from "@/lib/concessionaria-stats";
import { CATEGORIAS, type CategoriaKey } from "@/lib/categorias";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, Building2, Clock, Download, MapPin,
  ShieldAlert, TrendingUp, Users,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/concessionaria")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", u.user.id);

    const allowed = roles?.some((r) => r.role === "concessionaria" || r.role === "admin");
    if (!allowed) throw redirect({ to: "/painel" });
  },
  component: ConcessionariaPage,
});

function ConcessionariaPage() {
  const { isConcessionaria, isLoading: loadingRole } = useIsConcessionaria();
  const { data: membership, isLoading: loadingMember } = useConcessionariaMembership();
  const concessionariaId = membership?.concessionaria_id;
  const { data: scope, isLoading: loadingScope } = useConcessionariaScope(concessionariaId);
  const [mapMode, setMapMode] = useState<"heat" | "markers">("heat");

  const { data: allReports = [], isLoading } = useQuery({
    queryKey: ["concessionaria-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const reports = useMemo(() => {
    if (!concessionariaId || !scope) return [];
    return filterReportsInScope(
      allReports,
      concessionariaId,
      scope.rotas,
      scope.pedagios,
    );
  }, [allReports, concessionariaId, scope]);

  const { data: guardians = 0 } = useQuery({
    queryKey: ["concessionaria-guardians"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  if (loadingRole || isLoading || loadingMember || loadingScope) {
    return <p className="text-sm text-muted-foreground">Carregando painel...</p>;
  }

  if (!isConcessionaria) return null;

  if (!membership) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <h2 className="font-display text-xl font-bold">Acesso pendente</h2>
        <p className="mt-2 text-muted-foreground">
          Sua conta tem perfil de concessionária, mas ainda não está vinculada a uma operadora.
          Solicite à ABCR o vínculo da sua concessionária.
        </p>
      </div>
    );
  }

  const conc = membership.concessionaria;

  const porCat = countByCategory(reports);
  const porGrav = countBySeverity(reports);
  const funnel = statusFunnel(reports);
  const trend = dailyTrend(reports);
  const hourly = hourlyDistribution(reports);
  const hotspots = computeHotspots(reports);
  const statuses = countByStatus(reports);

  const kpis = [
    { label: "Ocorrências totais", value: reports.length, icon: Activity },
    { label: "Últimas 24h", value: reportsLast24h(reports), icon: TrendingUp },
    { label: "Últimos 7 dias", value: reportsLast7d(reports), icon: TrendingUp },
    { label: "Em análise", value: pendingValidation(reports), icon: Clock },
    { label: "Críticas abertas", value: criticalOpen(reports), icon: ShieldAlert },
    { label: "Taxa de resolução", value: `${resolutionRate(reports)}%`, icon: CheckIcon },
    { label: "Guardiões ativos", value: guardians, icon: Users },
    { label: "Reportadores únicos", value: uniqueReporters(reports), icon: Users },
  ];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">{conc.nome}</h1>
            <p className="text-muted-foreground">
              {conc.rodovia ?? "Rodovia"} · Alertas no seu trecho concedido ({reports.length} no escopo)
            </p>
          </div>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => exportReportsCsv(reports)}>
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <div key={k.label} className="rounded-2xl border bg-card p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <Icon className="h-4 w-4 text-primary/70" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold">{k.value}</p>
            </div>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <InsightCard title="Confiança média da IA" value={avgAiScore(reports) != null ? `${(avgAiScore(reports)! * 100).toFixed(0)}%` : "—"} hint="Score de classificação automática" />
        <InsightCard title="Tempo médio de resolução" value={avgResolutionMinutes(reports) != null ? `${avgResolutionMinutes(reports)} min` : "—"} hint="Da abertura ao status resolvido" />
        <InsightCard title="Pico de demanda" value={hourly.reduce((best, h) => (h.total > best.total ? h : best), hourly[0])?.hour ?? "—"} hint="Hora com mais reportes" />
      </div>

      <Tabs defaultValue="alertas">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="mapa">Mapa de calor</TabsTrigger>
          <TabsTrigger value="estatisticas">Estatísticas</TabsTrigger>
          <TabsTrigger value="hotspots">Pontos críticos</TabsTrigger>
          <TabsTrigger value="config">Pedágios e rota</TabsTrigger>
        </TabsList>

        <TabsContent value="alertas" className="space-y-4">
          <Tabs defaultValue="pendentes">
            <TabsList>
              <TabsTrigger value="pendentes">Em análise ({statuses.em_analise ?? 0})</TabsTrigger>
              <TabsTrigger value="criticos">Críticos ({criticalOpen(reports)})</TabsTrigger>
              <TabsTrigger value="validados">Validados ({statuses.validado ?? 0})</TabsTrigger>
              <TabsTrigger value="todos">Todos</TabsTrigger>
            </TabsList>
            <TabsContent value="pendentes"><AlertsPanel reports={reports} filter="em_analise" /></TabsContent>
            <TabsContent value="criticos"><AlertsPanel reports={reports} filter="criticos" /></TabsContent>
            <TabsContent value="validados"><AlertsPanel reports={reports} filter="validado" /></TabsContent>
            <TabsContent value="todos"><AlertsPanel reports={reports} filter="todos" /></TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="mapa" className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={mapMode === "heat" ? "default" : "outline"} onClick={() => setMapMode("heat")}>
              Calor
            </Button>
            <Button size="sm" variant={mapMode === "markers" ? "default" : "outline"} onClick={() => setMapMode("markers")}>
              Marcadores
            </Button>
          </div>
          <ConcessionariaHeatMap reports={reports} mode={mapMode} />
          <p className="text-xs text-muted-foreground">
            Intensidade ponderada por gravidade — vermelho indica maior risco acumulado na região.
          </p>
        </TabsContent>

        <TabsContent value="estatisticas" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="Ocorrências por dia (14 dias)">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Distribuição por hora do dia">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Por categoria">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porCat} layout="vertical">
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {porCat.map((d) => <Cell key={d.key} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Por gravidade">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={porGrav} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {porGrav.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
          <ChartCard title="Funil operacional">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnel}>
                <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#005A9C" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </TabsContent>

        <TabsContent value="hotspots">
          {hotspots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ainda não há clusters recorrentes de ocorrências.</p>
          ) : (
            <div className="overflow-hidden rounded-2xl border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Região</th>
                    <th className="px-4 py-3 text-left font-medium">Ocorrências</th>
                    <th className="px-4 py-3 text-left font-medium">Tipos</th>
                  </tr>
                </thead>
                <tbody>
                  {hotspots.map((h) => (
                    <tr key={h.label} className="border-b last:border-0">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-primary" />
                          {h.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold">{h.count}</td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {h.categories.map((c) => CATEGORIAS[c as CategoriaKey]?.label ?? c).join(", ")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Células com 2+ ocorrências no mesmo trecho (~1 km) — útil para planejar patrulha e sinalização.
          </p>
        </TabsContent>

        <TabsContent value="config">
          {concessionariaId && scope && (
            <ConcessionariaConfig
              concessionariaId={concessionariaId}
              rotas={scope.rotas}
              pedagios={scope.pedagios}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function InsightCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="mb-3 font-display text-base font-bold">{title}</h3>
      {children}
    </div>
  );
}
