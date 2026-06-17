import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Leaf, Heart, GraduationCap, TreeDeciduous } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { CATEGORIAS } from "@/lib/categorias";

export const Route = createFileRoute("/_authenticated/impacto")({ component: Impacto });

function Impacto() {
  const { data: reports } = useQuery({
    queryKey: ["my-reports-all"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      return (await supabase.from("reports").select("*").eq("user_id", u.user.id)).data ?? [];
    },
  });
  const total = reports?.length ?? 0;
  const animais = (reports ?? []).filter((r) => r.categoria === "animal_na_pista").length;
  const acidentes = (reports ?? []).filter((r) => r.categoria === "acidente").length;

  const metricas = [
    { l: "Animais protegidos", v: animais * 3, i: TreeDeciduous, c: "text-primary" },
    { l: "Vítimas potencialmente socorridas", v: acidentes * 2, i: Heart, c: "text-destructive" },
    { l: "Árvores equivalentes (CO₂)", v: Math.round(total * 0.8), i: Leaf, c: "text-primary" },
    { l: "Campanhas apoiadas", v: Math.max(1, Math.floor(total / 5)), i: GraduationCap, c: "text-accent" },
  ];

  const porCategoria = Object.entries(
    (reports ?? []).reduce<Record<string, number>>((a, r) => ({ ...a, [r.categoria]: (a[r.categoria] ?? 0) + 1 }), {}),
  ).map(([k, v]) => ({ name: CATEGORIAS[k as keyof typeof CATEGORIAS]?.label ?? k, value: v, fill: CATEGORIAS[k as keyof typeof CATEGORIAS]?.cor }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Meu Impacto</h1>
        <p className="text-muted-foreground">Cada reporte se transforma em vidas salvas, animais protegidos e CO₂ evitado.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricas.map((m) => {
          const I = m.i;
          return (
            <div key={m.l} className="rounded-2xl border bg-card p-5">
              <I className={`h-6 w-6 ${m.c}`} />
              <p className="mt-3 font-display text-3xl font-bold">{m.v}</p>
              <p className="text-xs text-muted-foreground">{m.l}</p>
            </div>
          );
        })}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="mb-4 font-display text-lg font-bold">Reportes por categoria</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={porCategoria}>
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
              <Bar dataKey="value" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="rounded-2xl border bg-card p-5">
          <h3 className="mb-4 font-display text-lg font-bold">Distribuição</h3>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porCategoria} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90}>
                {porCategoria.map((d, i) => <Cell key={i} fill={d.fill} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}