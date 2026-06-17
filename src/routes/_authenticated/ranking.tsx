import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getLevel } from "@/lib/levels";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/_authenticated/ranking")({ component: Ranking });

function Ranking() {
  const { data } = useQuery({
    queryKey: ["ranking"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, nome, cidade, pontos, nivel").order("pontos", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  return (
    <div>
      <div className="flex items-center gap-3">
        <Trophy className="h-7 w-7 text-accent" />
        <div>
          <h1 className="font-display text-3xl font-bold">Top 100 Guardiões</h1>
          <p className="text-muted-foreground">Os heróis que mais protegem nossas rodovias.</p>
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border bg-card">
        {(data ?? []).map((p, i) => {
          const lvl = getLevel(p.pontos);
          return (
            <div key={p.id} className="flex items-center justify-between border-b border-border/60 px-4 py-3 last:border-0">
              <div className="flex items-center gap-4">
                <span className={`grid h-8 w-8 place-items-center rounded-full text-sm font-bold ${i < 3 ? "gradient-primary text-primary-foreground" : "bg-surface"}`}>{i + 1}</span>
                <div>
                  <p className="font-semibold">{lvl.emoji} {p.nome}</p>
                  <p className="text-xs text-muted-foreground">{p.cidade ?? "—"} · Guardião {lvl.nome}</p>
                </div>
              </div>
              <p className="font-display text-lg font-bold text-primary">{p.pontos.toLocaleString("pt-BR")}</p>
            </div>
          );
        })}
        {!data?.length && <p className="p-6 text-sm text-muted-foreground">Ainda sem ranking. Seja o primeiro!</p>}
      </div>
    </div>
  );
}