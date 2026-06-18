import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useIsAbcr } from "@/hooks/useUserRole";
import { AlertsPanel } from "@/components/concessionaria/AlertsPanel";
import { ConcessionariaHeatMap } from "@/components/concessionaria/ConcessionariaHeatMap";
import {
  avgAiScore,
  avgResolutionMinutes,
  computeHotspots,
  countByCategory,
  countBySeverity,
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
import type { Concessionaria } from "@/hooks/useUserRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Activity, Building2, Download, Globe2, Loader2, Plus, Shield, TrendingUp, Users,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/abcr")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const allowed = roles?.some((r) => r.role === "abcr" || r.role === "admin");
    if (!allowed) throw redirect({ to: "/painel" });
  },
  component: AbcrPage,
});

function AbcrPage() {
  const { isAbcr, isLoading: loadingRole } = useIsAbcr();
  const qc = useQueryClient();
  const [mapMode, setMapMode] = useState<"heat" | "markers">("heat");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["abcr-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reports").select("*").order("created_at", { ascending: false }).limit(5000);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const { data: concessionarias = [] } = useQuery({
    queryKey: ["abcr-concessionarias"],
    queryFn: async () => {
      const { data, error } = await supabase.from("concessionarias").select("*").order("nome");
      if (error) throw error;
      return (data ?? []) as Concessionaria[];
    },
  });

  const { data: guardians = 0 } = useQuery({
    queryKey: ["abcr-guardians"],
    queryFn: async () => {
      const { count } = await supabase.from("profiles").select("id", { count: "exact", head: true });
      return count ?? 0;
    },
  });

  if (loadingRole || isLoading) return <p className="text-sm text-muted-foreground">Carregando painel ABCR...</p>;
  if (!isAbcr) return null;

  const porCat = countByCategory(reports);
  const porGrav = countBySeverity(reports);
  const funnel = statusFunnel(reports);
  const trend = dailyTrend(reports, 30);
  const hourly = hourlyDistribution(reports);
  const statuses = countByStatus(reports);

  const reportsByConc = concessionarias.map((c) => ({
    ...c,
    total: reports.filter((r) => r.concessionaria_id === c.id).length,
  }));

  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-accent/20">
            <Globe2 className="h-6 w-6 text-accent" />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold">Painel Nacional ABCR</h1>
            <p className="text-muted-foreground">
              Visão completa do ecossistema RoadHero — todas as concessionárias e rodovias do país.
            </p>
          </div>
        </div>
        <Button variant="outline" className="gap-2" onClick={() => exportReportsCsv(reports)}>
          <Download className="h-4 w-4" /> Exportar nacional
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ocorrências nacionais", value: reports.length, icon: Activity },
          { label: "Últimas 24h", value: reportsLast24h(reports), icon: TrendingUp },
          { label: "Concessionárias", value: concessionarias.length, icon: Building2 },
          { label: "Guardiões", value: guardians, icon: Users },
          { label: "Em análise", value: pendingValidation(reports), icon: Shield },
          { label: "Críticas abertas", value: criticalOpen(reports), icon: Shield },
          { label: "Taxa resolução", value: `${resolutionRate(reports)}%`, icon: TrendingUp },
          { label: "Reportadores únicos", value: uniqueReporters(reports), icon: Users },
        ].map((k) => {
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
        <Stat hint="Média nacional" title="Confiança IA" value={avgAiScore(reports) != null ? `${(avgAiScore(reports)! * 100).toFixed(0)}%` : "—"} />
        <Stat hint="Tempo até resolvido" title="Resolução média" value={avgResolutionMinutes(reports) != null ? `${avgResolutionMinutes(reports)} min` : "—"} />
        <Stat hint="Sem limite viário" title="Cobertura" value="Nacional" />
      </div>

      <Tabs defaultValue="nacional">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="nacional">Mapa nacional</TabsTrigger>
          <TabsTrigger value="alertas">Todos os alertas</TabsTrigger>
          <TabsTrigger value="estatisticas">Insights</TabsTrigger>
          <TabsTrigger value="concessionarias">Concessionárias</TabsTrigger>
        </TabsList>

        <TabsContent value="nacional" className="space-y-3">
          <div className="flex gap-2">
            <Button size="sm" variant={mapMode === "heat" ? "default" : "outline"} onClick={() => setMapMode("heat")}>Calor</Button>
            <Button size="sm" variant={mapMode === "markers" ? "default" : "outline"} onClick={() => setMapMode("markers")}>Marcadores</Button>
          </div>
          <ConcessionariaHeatMap reports={reports} mode={mapMode} />
        </TabsContent>

        <TabsContent value="alertas">
          <AlertsPanel reports={reports} filter="todos" />
        </TabsContent>

        <TabsContent value="estatisticas" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Chart title="Tendência 30 dias">
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={4} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Line type="monotone" dataKey="total" stroke="var(--primary)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Chart>
            <Chart title="Por hora">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={hourly}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tick={{ fontSize: 9 }} interval={2} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="total" fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
            </Chart>
            <Chart title="Categorias">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={porCat} layout="vertical">
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
                  <Tooltip />
                  <Bar dataKey="value">{porCat.map((d) => <Cell key={d.key} fill={d.fill} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </Chart>
            <Chart title="Gravidade">
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie data={porGrav} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80}>
                    {porGrav.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Chart>
          </div>
          <Chart title="Funil nacional">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={funnel}>
                <XAxis dataKey="stage" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#005A9C" />
              </BarChart>
            </ResponsiveContainer>
          </Chart>
          <div className="overflow-hidden rounded-2xl border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40">
                <tr>
                  <th className="px-4 py-3 text-left">Concessionária</th>
                  <th className="px-4 py-3 text-left">Rodovia</th>
                  <th className="px-4 py-3 text-left">Alertas</th>
                </tr>
              </thead>
              <tbody>
                {reportsByConc.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{c.nome}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.rodovia ?? "—"}</td>
                    <td className="px-4 py-3">{c.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="concessionarias">
          <ConcessionariasAdmin
            concessionarias={concessionarias}
            onRefresh={() => {
              void qc.invalidateQueries({ queryKey: ["abcr-concessionarias"] });
              void qc.invalidateQueries({ queryKey: ["abcr-members"] });
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type MemberRow = {
  user_id: string;
  concessionaria_id: string;
  cargo: string | null;
  profiles: { nome: string } | null;
  concessionarias: { nome: string } | null;
};

function ConcessionariasAdmin({
  concessionarias,
  onRefresh,
}: {
  concessionarias: Concessionaria[];
  onRefresh: () => void;
}) {
  const [nome, setNome] = useState("");
  const [sigla, setSigla] = useState("");
  const [rodovia, setRodovia] = useState("");
  const [uf, setUf] = useState("");
  const [memberUserId, setMemberUserId] = useState("");
  const [memberConcId, setMemberConcId] = useState("");
  const [memberCargo, setMemberCargo] = useState("operador");

  const { data: members = [] } = useQuery({
    queryKey: ["abcr-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("concessionaria_members")
        .select("user_id, concessionaria_id, cargo, profiles(nome), concessionarias(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });

  const { data: concessionariaUsers = [] } = useQuery({
    queryKey: ["abcr-concessionaria-users", members.map((m) => m.user_id).join(",")],
    queryFn: async () => {
      const { data: roles, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles(nome)")
        .eq("role", "concessionaria");
      if (error) throw error;
      const memberIds = new Set(members.map((m) => m.user_id));
      return (roles ?? [])
        .filter((r) => !memberIds.has(r.user_id))
        .map((r) => ({
          user_id: r.user_id,
          nome: (r.profiles as { nome: string } | null)?.nome ?? "—",
        }));
    },
  });

  const assignMember = useMutation({
    mutationFn: async () => {
      if (!memberUserId.trim() || !memberConcId) throw new Error("Informe usuário e concessionária");
      const { error } = await supabase.from("concessionaria_members").insert({
        user_id: memberUserId.trim(),
        concessionaria_id: memberConcId,
        cargo: memberCargo.trim() || "operador",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usuário vinculado à concessionária");
      setMemberUserId("");
      onRefresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (row: { user_id: string; concessionaria_id: string }) => {
      const { error } = await supabase
        .from("concessionaria_members")
        .delete()
        .eq("user_id", row.user_id)
        .eq("concessionaria_id", row.concessionaria_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo removido");
      onRefresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!nome.trim()) throw new Error("Nome obrigatório");
      const { error } = await supabase.from("concessionarias").insert({
        nome: nome.trim(),
        sigla: sigla.trim() || null,
        rodovia: rodovia.trim() || null,
        uf: uf.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Concessionária criada");
      setNome("");
      setSigla("");
      setRodovia("");
      setUf("");
      onRefresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <h3 className="font-display font-bold">Nova concessionária</h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label>Sigla</Label><Input value={sigla} onChange={(e) => setSigla(e.target.value)} /></div>
          <div><Label>Rodovia</Label><Input value={rodovia} onChange={(e) => setRodovia(e.target.value)} placeholder="BR-101" /></div>
          <div><Label>UF</Label><Input value={uf} onChange={(e) => setUf(e.target.value)} maxLength={2} /></div>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending} className="gap-2">
          {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Cadastrar
        </Button>
      </div>

      <ul className="divide-y rounded-2xl border">
        {concessionarias.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-4 px-4 py-4">
            <div>
              <p className="font-medium">{c.nome} {c.sigla && `(${c.sigla})`}</p>
              <p className="text-xs text-muted-foreground">{c.rodovia ?? "—"} · {c.uf ?? "—"}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs ${c.ativa ? "bg-green-500/10 text-green-700" : "bg-muted text-muted-foreground"}`}>
              {c.ativa ? "Ativa" : "Inativa"}
            </span>
          </li>
        ))}
      </ul>

      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <h3 className="font-display font-bold">Vínculo usuário ↔ concessionária</h3>
        <p className="text-sm text-muted-foreground">
          Conceda acesso operacional vinculando contas com perfil concessionária à operadora correta.
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>ID do usuário</Label>
            <Input
              value={memberUserId}
              onChange={(e) => setMemberUserId(e.target.value)}
              placeholder="UUID do auth.users"
            />
          </div>
          <div>
            <Label>Concessionária</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={memberConcId}
              onChange={(e) => setMemberConcId(e.target.value)}
            >
              <option value="">Selecione</option>
              {concessionarias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Cargo</Label>
            <Input value={memberCargo} onChange={(e) => setMemberCargo(e.target.value)} placeholder="operador" />
          </div>
          <div className="flex items-end">
            <Button onClick={() => assignMember.mutate()} disabled={assignMember.isPending} className="w-full gap-2">
              {assignMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
              Vincular
            </Button>
          </div>
        </div>

        {concessionariaUsers.length > 0 && (
          <div className="rounded-xl border bg-muted/30 p-3 text-sm">
            <p className="font-medium">Perfis concessionária sem vínculo</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {concessionariaUsers.map((u) => (
                <li key={u.user_id}>
                  <button
                    type="button"
                    className="text-left hover:text-primary underline-offset-2 hover:underline"
                    onClick={() => setMemberUserId(u.user_id)}
                  >
                    {u.nome} — <code className="text-xs">{u.user_id}</code>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="px-4 py-3 text-left">Usuário</th>
              <th className="px-4 py-3 text-left">Concessionária</th>
              <th className="px-4 py-3 text-left">Cargo</th>
              <th className="px-4 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={`${m.user_id}-${m.concessionaria_id}`} className="border-b last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{m.profiles?.nome ?? "—"}</p>
                  <p className="text-xs text-muted-foreground font-mono">{m.user_id}</p>
                </td>
                <td className="px-4 py-3">{m.concessionarias?.nome ?? "—"}</td>
                <td className="px-4 py-3 text-muted-foreground">{m.cargo ?? "operador"}</td>
                <td className="px-4 py-3 text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => removeMember.mutate({ user_id: m.user_id, concessionaria_id: m.concessionaria_id })}
                  >
                    Remover
                  </Button>
                </td>
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">Nenhum vínculo cadastrado.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Chart({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <h3 className="mb-3 font-display text-base font-bold">{title}</h3>
      {children}
    </div>
  );
}
