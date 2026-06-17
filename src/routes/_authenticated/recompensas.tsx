import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Gift } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recompensas")({ component: Recompensas });

function Recompensas() {
  const qc = useQueryClient();
  const { data: rewards } = useQuery({
    queryKey: ["rewards"],
    queryFn: async () => (await supabase.from("rewards").select("*").eq("ativo", true).order("custo_pontos")).data ?? [],
  });
  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      return (await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle()).data;
    },
  });
  const pontos = profile?.pontos ?? 0;

  async function resgatar(rewardId: string, custo: number) {
    if (!profile) return;
    if (pontos < custo) return toast.error("Pontos insuficientes");
    const { error } = await supabase.from("redemptions").insert({ user_id: profile.id, reward_id: rewardId, pontos_gastos: custo });
    if (error) return toast.error(error.message);
    await supabase.from("profiles").update({ pontos: pontos - custo }).eq("id", profile.id);
    toast.success("Recompensa resgatada!");
    qc.invalidateQueries();
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gift className="h-7 w-7 text-accent" />
          <div>
            <h1 className="font-display text-3xl font-bold">Recompensas</h1>
            <p className="text-muted-foreground">Troque seus pontos por benefícios reais.</p>
          </div>
        </div>
        <p className="rounded-full bg-surface px-4 py-2 text-sm font-semibold">{pontos.toLocaleString("pt-BR")} pts</p>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(rewards ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card p-5">
            <h3 className="font-display text-lg font-bold">{r.nome}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{r.descricao}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">{r.custo_pontos} pts</span>
              <Button size="sm" disabled={pontos < r.custo_pontos} onClick={() => resgatar(r.id, r.custo_pontos)}>Resgatar</Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}