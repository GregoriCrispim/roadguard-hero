import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { supabase } from "@/integrations/supabase/client";
import { resgatarRecompensa, type ResgateCriado } from "@/lib/resgate-recompensa.functions";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Gift, Loader2, QrCode } from "lucide-react";
import { toast } from "sonner";

type Reward = {
  id: string;
  nome: string;
  descricao: string | null;
  custo_pontos: number;
  categoria: string | null;
  partner_id: string | null;
  partners?: { nome_fantasia: string } | null;
};

type PendingRedemption = {
  id: string;
  codigo: string;
  status: string;
  expires_at: string;
  pontos_gastos: number;
  rewards: { nome: string } | null;
};

export const Route = createFileRoute("/_authenticated/recompensas")({ component: Recompensas });

function Recompensas() {
  const qc = useQueryClient();
  const resgatar = useServerFn(resgatarRecompensa);
  const [qrResgate, setQrResgate] = useState<ResgateCriado | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const { data: rewards, isError: rewardsError, error: rewardsQueryError } = useQuery({
    queryKey: ["rewards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select("*, partners(nome_fantasia)")
        .eq("ativo", true)
        .not("partner_id", "is", null)
        .order("custo_pontos");
      if (error) throw error;
      return (data ?? []) as Reward[];
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;
      return (await supabase.from("profiles").select("*").eq("id", u.user.id).maybeSingle()).data;
    },
  });

  const { data: pendentes = [] } = useQuery({
    queryKey: ["my-pending-redemptions"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("redemptions")
        .select("id, codigo, status, expires_at, pontos_gastos, rewards(nome)")
        .eq("user_id", u.user.id)
        .eq("status", "pendente")
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PendingRedemption[];
    },
    refetchInterval: 10_000,
  });

  const pontos = profile?.pontos ?? 0;

  // Notificação em tempo real quando parceiro valida o QR
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    void (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;

      channel = supabase
        .channel(`redemptions-${u.user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "redemptions", filter: `user_id=eq.${u.user.id}` },
          (payload) => {
            const row = payload.new as { status: string; pontos_gastos: number; codigo: string };
            if (row.status === "validado") {
              toast.success(`Resgate ${row.codigo} confirmado! −${row.pontos_gastos} pontos.`);
              setQrResgate(null);
              void qc.invalidateQueries();
            } else if (row.status === "expirado") {
              toast.error(`Resgate ${row.codigo} expirou.`);
              setQrResgate(null);
              void qc.invalidateQueries();
            }
          },
        )
        .subscribe();
    })();

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [qc]);

  async function handleResgatar(rewardId: string, custo: number) {
    if (!profile) return;
    if (pontos < custo) return toast.error("Pontos insuficientes");
    setLoadingId(rewardId);
    try {
      const result = await resgatar({ data: { rewardId } });
      setQrResgate(result);
      toast.info("Apresente o QR Code ao parceiro para concluir o resgate.");
      void qc.invalidateQueries({ queryKey: ["my-pending-redemptions"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao resgatar");
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Gift className="h-7 w-7 text-accent" />
          <div>
            <h1 className="font-display text-3xl font-bold">Recompensas</h1>
            <p className="text-muted-foreground">Troque seus pontos por benefícios de parceiros reais.</p>
          </div>
        </div>
        <p className="rounded-full bg-surface px-4 py-2 text-sm font-semibold">{pontos.toLocaleString("pt-BR")} pts</p>
      </div>

      {pendentes.length > 0 && (
        <div className="mt-6 rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4">
          <h3 className="font-display font-bold text-amber-800 dark:text-amber-200">Resgates aguardando validação</h3>
          <ul className="mt-2 space-y-2">
            {pendentes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>{p.rewards?.nome ?? "Recompensa"} — <code className="font-mono">{p.codigo}</code></span>
                <Button size="sm" variant="outline" className="gap-1" onClick={() => setQrResgate({
                  id: p.id,
                  codigo: p.codigo,
                  expires_at: p.expires_at,
                  pontos_gastos: p.pontos_gastos,
                  reward_nome: p.rewards?.nome ?? "",
                })}>
                  <QrCode className="h-3.5 w-3.5" /> Ver QR
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(rewards ?? []).map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card p-5">
            <p className="text-xs font-medium text-primary">{r.partners?.nome_fantasia ?? "Parceiro"}</p>
            <h3 className="mt-1 font-display text-lg font-bold">{r.nome}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{r.descricao}</p>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-primary">{r.custo_pontos} pts</span>
              <Button
                size="sm"
                disabled={pontos < r.custo_pontos || loadingId === r.id}
                onClick={() => handleResgatar(r.id, r.custo_pontos)}
              >
                {loadingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Resgatar"}
              </Button>
            </div>
          </div>
        ))}
        {rewardsError && (
          <p className="col-span-full text-center text-destructive py-12">
            Não foi possível carregar as recompensas. Tente atualizar a página.
            {rewardsQueryError instanceof Error ? ` (${rewardsQueryError.message})` : ""}
          </p>
        )}
        {!rewardsError && (rewards ?? []).length === 0 && (
          <p className="col-span-full text-center text-muted-foreground py-12">Nenhuma recompensa disponível no momento.</p>
        )}
      </div>

      <Dialog open={!!qrResgate} onOpenChange={(o) => !o && setQrResgate(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code do resgate</DialogTitle>
            <DialogDescription>
              Apresente este código ao funcionário do parceiro. Os pontos só serão abatidos após a validação.
            </DialogDescription>
          </DialogHeader>
          {qrResgate && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="rounded-xl border bg-white p-4">
                <QRCodeSVG value={qrResgate.codigo} size={200} level="M" />
              </div>
              <p className="font-mono text-lg font-bold tracking-wider">{qrResgate.codigo}</p>
              <p className="text-center text-sm text-muted-foreground">
                {qrResgate.reward_nome} · {qrResgate.pontos_gastos} pts
              </p>
              <p className="text-xs text-muted-foreground">
                Válido até {new Date(qrResgate.expires_at).toLocaleString("pt-BR")}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
