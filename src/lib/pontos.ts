export type Gravidade = "baixa" | "media" | "alta" | "critica";

export const PONTOS_POR_GRAVIDADE: Record<Gravidade, number> = {
  baixa: 30,
  media: 60,
  alta: 120,
  critica: 200,
};

export function pontosFromGravidade(gravidade: Gravidade | string | null | undefined): number {
  if (!gravidade || !(gravidade in PONTOS_POR_GRAVIDADE)) return PONTOS_POR_GRAVIDADE.media;
  return PONTOS_POR_GRAVIDADE[gravidade as Gravidade];
}
