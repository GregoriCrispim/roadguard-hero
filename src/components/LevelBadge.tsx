import { getLevel, progressToNext } from "@/lib/levels";
import { Progress } from "@/components/ui/progress";

export function LevelBadge({ pontos, compact }: { pontos: number; compact?: boolean }) {
  const lvl = getLevel(pontos);
  const { pct, restante, proximo } = progressToNext(pontos);
  if (compact) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1 text-xs font-semibold">
        <span>{lvl.emoji}</span>
        <span>Guardião {lvl.nome}</span>
        <span className="text-muted-foreground">· {pontos.toLocaleString("pt-BR")} pts</span>
      </span>
    );
  }
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Seu nível</p>
          <p className="font-display text-2xl font-bold">
            {lvl.emoji} Guardião {lvl.nome}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-primary">{pontos.toLocaleString("pt-BR")}</p>
          <p className="text-xs text-muted-foreground">pontos</p>
        </div>
      </div>
      <div className="mt-4">
        <Progress value={pct} className="h-2" />
        <p className="mt-1.5 text-xs text-muted-foreground">
          {proximo ? `Faltam ${restante} pts para Guardião ${proximo}` : "Nível máximo alcançado 💎"}
        </p>
      </div>
    </div>
  );
}