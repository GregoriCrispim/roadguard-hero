import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { LevelBadge } from "@/components/LevelBadge";
import { CATEGORIAS } from "@/lib/categorias";
import { Map, Trophy, Gift, Sparkles, Navigation } from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelPage,
});

function PainelPage() {
  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });
  const { data: reports } = useQuery({
    queryKey: ["my-reports"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase.from("reports").select("*").eq("user_id", u.user.id).order("created_at", { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const pontos = profile?.pontos ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Olá, {profile?.nome ?? "Guardião"} 👋</h1>
        <p className="text-muted-foreground">Sua missão: tornar as rodovias mais seguras.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2"><LevelBadge pontos={pontos} /></div>
        <Link to="/app" className="group rounded-2xl border border-primary/30 bg-card p-6 transition hover:border-primary/60">
          <div className="grid h-12 w-12 place-items-center rounded-xl gradient-primary glow-primary">
            <Navigation className="h-6 w-6 text-primary-foreground" />
          </div>
          <h3 className="mt-4 font-display text-lg font-bold">Voltar ao mapa</h3>
          <p className="text-sm text-muted-foreground">GPS, rotas e reportes por voz.</p>
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { to: "/app", l: "Mapa / Rotas", i: Navigation },
          { to: "/mapa", l: "Ocorrências", i: Map },
          { to: "/ranking", l: "Ranking", i: Trophy },
          { to: "/recompensas", l: "Recompensas", i: Gift },
          { to: "/guardiao", l: "Guardião IA", i: Sparkles },
        ].map((q) => {
          const Icon = q.i;
          return (
            <Link key={q.to} to={q.to} className="flex items-center gap-3 rounded-2xl border bg-card p-4 transition hover:border-primary/40">
              <Icon className="h-5 w-5 text-primary" /> <span className="font-medium">{q.l}</span>
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <h2 className="font-display text-xl font-bold">Seus últimos reportes</h2>
        {!reports?.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            Você ainda não fez reportes. <Link to="/app" className="text-primary underline">Inicie uma viagem.</Link>
          </p>
        )}
        <ul className="mt-4 divide-y divide-border">
          {reports?.map((r) => {
            const c = CATEGORIAS[r.categoria as keyof typeof CATEGORIAS];
            const Icon = c?.icon;
            return (
              <li key={r.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  {Icon && <Icon className="h-5 w-5" style={{ color: c?.cor }} />}
                  <div>
                    <p className="font-medium">{c?.label}</p>
                    <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString("pt-BR")} · {r.status}</p>
                  </div>
                </div>
                {r.gravidade && <span className="rounded-full bg-surface px-2 py-0.5 text-xs">{r.gravidade}</span>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
