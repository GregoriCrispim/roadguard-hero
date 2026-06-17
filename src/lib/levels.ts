export type Nivel = "Bronze" | "Prata" | "Ouro" | "Diamante";

export const LEVELS: { nome: Nivel; min: number; max: number; cor: string; emoji: string; beneficios: string[] }[] = [
  { nome: "Bronze", min: 0, max: 500, cor: "oklch(0.62 0.13 60)", emoji: "🥉", beneficios: ["Acesso ao mapa", "Reportes ilimitados"] },
  { nome: "Prata", min: 501, max: 2000, cor: "oklch(0.78 0.02 250)", emoji: "🥈", beneficios: ["Café grátis", "Badge no perfil"] },
  { nome: "Ouro", min: 2001, max: 5000, cor: "oklch(0.82 0.18 90)", emoji: "🥇", beneficios: ["Cashback em pedágios", "Descontos em combustível"] },
  { nome: "Diamante", min: 5001, max: Infinity, cor: "oklch(0.78 0.12 200)", emoji: "💎", beneficios: ["Recompensas exclusivas", "Acesso prioritário a campanhas"] },
];

export function getLevel(pontos: number) {
  return LEVELS.find((l) => pontos >= l.min && pontos <= l.max) ?? LEVELS[0];
}

export function progressToNext(pontos: number) {
  const cur = getLevel(pontos);
  const idx = LEVELS.indexOf(cur);
  const next = LEVELS[idx + 1];
  if (!next) return { pct: 100, restante: 0, proximo: null as Nivel | null };
  const span = next.min - cur.min;
  const done = pontos - cur.min;
  return { pct: Math.min(100, Math.round((done / span) * 100)), restante: next.min - pontos, proximo: next.nome };
}