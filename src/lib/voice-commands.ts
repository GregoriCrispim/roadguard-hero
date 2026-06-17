import type { CategoriaKey } from "@/lib/categorias";

const PHRASES: Array<{ patterns: RegExp[]; categoria: CategoriaKey }> = [
  {
    categoria: "animal_na_pista",
    patterns: [
      /animal/,
      /cachorro/,
      /cavalo/,
      /boi/,
      /vaca/,
      /cervo/,
      /on[cç]a/,
      /bicho/,
      /fauna/,
      /cachorra/,
      /porco/,
      /cabra/,
      /ave/,
      /pássaro/,
      /passaro/,
      /(vi|tem|tem um|tem uma).*(cavalo|cachorro|animal|boi|vaca)/,
      /(na pista|na via|na rodovia).*(animal|cavalo|cachorro|boi)/,
    ],
  },
  {
    categoria: "veiculo_parado",
    patterns: [
      /ve[ií]culo parado/,
      /carro parado/,
      /caminh[aã]o parado/,
      /moto parada/,
      /pane/,
      /quebrado/,
      /parado na pista/,
      /parado na via/,
      /(vi|tem).*(carro|ve[ií]culo|caminh[aã]o).*(parado|quebrado)/,
    ],
  },
  {
    categoria: "acidente",
    patterns: [
      /acidente/,
      /batida/,
      /colis[aã]o/,
      /capotamento/,
      /atropelamento/,
      /engavetamento/,
      /bateu/,
      /colidiu/,
      /carros batendo/,
      /(teve|houve|tem).*(acidente|batida|colis[aã]o)/,
    ],
  },
  {
    categoria: "objeto_na_pista",
    patterns: [
      /objeto/,
      /carga/,
      /pneu/,
      /entulho/,
      /barreira/,
      /obst[aá]culo/,
      /caixa/,
      /madeira/,
      /pedra/,
      /(na pista|na via).*(objeto|pneu|carga|entulho)/,
    ],
  },
  {
    categoria: "incendio",
    patterns: [/inc[eê]ndio/, /fogo/, /queimada/, /chamas/, /fumaca/, /fuma[cç]a/],
  },
  {
    categoria: "risco_seguranca",
    patterns: [
      /risco/,
      /perigo/,
      /buraco/,
      /pista escorregadia/,
      /sem sinaliza/,
      /sinaliza[cç][aã]o/,
      /desnível/,
      /desnivel/,
    ],
  },
  {
    categoria: "clima_severo",
    patterns: [
      /chuva/,
      /neblina/,
      /alagamento/,
      /tempestade/,
      /granizo/,
      /ventania/,
      /clima/,
      /visibilidade/,
      /muita chuva/,
      /chovendo forte/,
    ],
  },
  {
    categoria: "suspeita_assalto",
    patterns: [/assalto/, /roubo/, /suspeita/, /sequestro/, /abordagem/, /suspeito/, /marginal/],
  },
];

const CANCEL = [/cancelar/, /parar de ouvir/, /desistir/];
const REPORT_ONLY = [/^(reportar|reporte|avisar|alertar)$/];

export type VoiceCommand =
  | { type: "categoria"; categoria: CategoriaKey; raw: string }
  | { type: "report_prompt"; raw: string }
  | { type: "cancel"; raw: string }
  | { type: "unknown"; raw: string };

/** Inferência por palavras-chave para frases naturais quando IA não está disponível */
export function inferReportFromNaturalSpeech(
  text: string,
): { categoria: CategoriaKey; confianca: number } | null {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  const contextBoost =
    /(pista|rodovia|via|faixa|frente|ali|aqui|sentido)/.test(normalized) ? 0.35 : 0;

  const scores = new Map<CategoriaKey, number>();
  for (const entry of PHRASES) {
    let score = 0;
    for (const pattern of entry.patterns) {
      if (pattern.test(normalized)) score += 1;
    }
    if (score > 0) scores.set(entry.categoria, score + contextBoost);
  }

  let best: CategoriaKey | null = null;
  let bestScore = 0;
  for (const [cat, score] of scores) {
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }

  if (!best || bestScore < 0.5) return null;
  return { categoria: best, confianca: Math.min(0.88, 0.45 + bestScore * 0.2) };
}

export function parseVoiceCommand(text: string): VoiceCommand {
  const raw = text.trim();
  const normalized = raw
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");

  if (CANCEL.some((p) => p.test(normalized))) {
    return { type: "cancel", raw };
  }

  for (const entry of PHRASES) {
    if (entry.patterns.some((p) => p.test(normalized))) {
      return { type: "categoria", categoria: entry.categoria, raw };
    }
  }

  if (REPORT_ONLY.some((p) => p.test(normalized))) {
    return { type: "report_prompt", raw };
  }

  return { type: "unknown", raw };
}

export const VOICE_HINTS = [
  "Fale naturalmente: tem um cavalo na pista",
  "Ou: acidente à frente",
  "Ou: carro parado na direita",
  "Ou: muita neblina na rodovia",
];
