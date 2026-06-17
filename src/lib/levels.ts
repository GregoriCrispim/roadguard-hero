export type Nivel = "Bronze" | "Prata" | "Ouro" | "Diamante";

export const LEVELS: { nome: Nivel; min: number; max: number; cor: string; emoji: string; beneficios: string[] }[] = [
  { nome: "Bronze", min: 0, max: 500, cor: "#A0522D", emoji: "🥉", beneficios: ["Acesso ao mapa", "Reportes ilimitados"] },
  { nome: "Prata", min: 501, max: 2000, cor: "#94A3B8", emoji: "🥈", beneficios: ["Café grátis", "Badge no perfil"] },
  { nome: "Ouro", min: 2001, max: 5000, cor: "#F59E0B", emoji: "🥇", beneficios: ["Cashback em pedágios", "Descontos em combustível"] },
  { nome: "Diamante", min: 5001, max: Infinity, cor: "#005A9C", emoji: "💎", beneficios: ["Recompensas exclusivas", "Acesso prioritário a campanhas"] },
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