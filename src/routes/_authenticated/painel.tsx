import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { LevelBadge } from "@/components/LevelBadge";
import { CATEGORIAS } from "@/lib/categorias";
import { reconciliarPontos } from "@/lib/reconciliar-pontos.functions";
import { useIsConcessionaria, useIsAbcr } from "@/hooks/useUserRole";
import { Map, Trophy, Gift, Sparkles, Navigation, Loader2, Building2, Globe2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/painel")({
  component: PainelPage,
});

function PainelPage() {
  const qc = useQueryClient();
  const reconciliar = useServerFn(reconciliarPontos);
  const { isConcessionaria } = useIsConcessionaria();
  const { isAbcr } = useIsAbcr();

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      const { data } = await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle();
      return data;
    },
  });

  const {
    data: reports,
    isLoading: loadingReports,
    isError: reportsError,
    refetch: refetchReports,
  } = useQuery({
    queryKey: ["my-reports"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("reports")
        .select("*")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    void (async () => {
      try {
        const res = await reconciliar();
        if (res.pontosAdicionados > 0) {
          await qc.invalidateQueries({ queryKey: ["me"] });
          await qc.invalidateQueries({ queryKey: ["my-reports"] });
        }
      } catch {
        /* reconciliação é best-effort */
      }
    })();
  }, [reconciliar, qc]);

  const pontos = profile?.pontos ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Olá, {profile?.nome ?? "Guardião"} 👋</h1>
        <p className="text-muted-foreground">Sua missão: tornar as rodovias mais seguras.</p>
        {isAbcr && (
          <Link
            to="/abcr"
            className="mt-3 ml-0 inline-flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/5 px-4 py-2 text-sm font-medium text-accent transition hover:bg-accent/10"
          >
            <Globe2 className="h-4 w-4" /> Painel Nacional ABCR
          </Link>
        )}
        {isConcessionaria && (
          <Link
            to="/concessionaria"
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-4 py-2 text-sm font-medium text-primary transition hover:bg-primary/10"
          >
            <Building2 className="h-4 w-4" /> Acessar Central da Concessionária
          </Link>
        )}
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
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl font-bold">Meus reportes</h2>
          <button
            type="button"
            onClick={() => refetchReports()}
            className="text-sm text-primary underline"
          >
            Atualizar
          </button>
        </div>

        {loadingReports && (
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando reportes...
          </div>
        )}

        {reportsError && (
          <p className="mt-3 text-sm text-destructive">Erro ao carregar reportes. Tente atualizar.</p>
        )}

        {!loadingReports && !reportsError && !reports?.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            Você ainda não fez reportes.{" "}
            <Link to="/app" className="text-primary underline">Inicie uma viagem</Link>, toque no microfone e fale naturalmente (ex.: &quot;tem um cavalo na pista&quot;).
          </p>
        )}

        <ul className="mt-4 divide-y divide-border">
          {reports?.map((r) => {
            const c = CATEGORIAS[r.categoria as keyof typeof CATEGORIAS];
            const Icon = c?.icon;
            return (
              <li key={r.id} className="flex items-start justify-between gap-3 py-3">
                <div className="flex min-w-0 items-start gap-3">
                  {Icon && <Icon className="mt-0.5 h-5 w-5 shrink-0" style={{ color: c?.cor }} />}
                  <div className="min-w-0">
                    <p className="font-medium">{c?.label ?? r.categoria}</p>
                    {r.descricao && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{r.descricao}</p>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                      {r.status ? ` · ${r.status === "validado" ? "validado ✓" : r.status}` : ""}
                      {r.gravidade ? ` · gravidade ${r.gravidade}` : ""}
                    </p>
                  </div>
                </div>
                {r.gravidade && (
                  <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs">{r.gravidade}</span>
                )}
              </li>
            );
          })}
        </ul>

        {reports && reports.length > 0 && (
          <p className="mt-4 text-xs text-muted-foreground">
            {reports.length} reporte(s) ·{" "}
            <Link to="/mapa" className="text-primary underline">Ver no mapa geral</Link>
          </p>
        )}
      </div>
    </div>
  );
}
