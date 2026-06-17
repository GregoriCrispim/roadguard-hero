import type { CategoriaKey } from "@/lib/categorias";

const PHRASES: Array<{ patterns: RegExp[]; categoria: CategoriaKey }> = [
  {
    categoria: "animal_na_pista",
    patterns: [/animal/, /cachorro/, /cavalo/, /boi/, /vaca/, /cervo/, /onça/, /onca/],
  },
  {
    categoria: "veiculo_parado",
    patterns: [/ve[ií]culo parado/, /carro parado/, /caminh[aã]o parado/, /pane/, /quebrado na pista/],
  },
  {
    categoria: "acidente",
    patterns: [/acidente/, /batida/, /colis[aã]o/, /capotamento/, /atropelamento/, /engavetamento/],
  },
  {
    categoria: "objeto_na_pista",
    patterns: [/objeto/, /carga/, /pneu/, /entulho/, /barreira/, /obst[aá]culo/],
  },
  {
    categoria: "incendio",
    patterns: [/inc[eê]ndio/, /fogo/, /queimada/, /chamas/],
  },
  {
    categoria: "risco_seguranca",
    patterns: [/risco/, /perigo/, /buraco/, /pista escorregadia/, /sem sinaliza/],
  },
  {
    categoria: "clima_severo",
    patterns: [/chuva/, /neblina/, /alagamento/, /tempestade/, /granizo/, /ventania/, /clima/],
  },
  {
    categoria: "suspeita_assalto",
    patterns: [/assalto/, /roubo/, /suspeita/, /sequestro/, /abordagem/],
  },
];

const CANCEL = [/cancelar/, /parar/, /desistir/];
const REPORT = [/reportar/, /reporte/, /avisar/, /alertar/];

export type VoiceCommand =
  | { type: "categoria"; categoria: CategoriaKey; raw: string }
  | { type: "report_prompt"; raw: string }
  | { type: "cancel"; raw: string }
  | { type: "unknown"; raw: string };

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

  if (REPORT.some((p) => p.test(normalized))) {
    return { type: "report_prompt", raw };
  }

  return { type: "unknown", raw };
}

export const VOICE_HINTS = [
  "Diga: animal na pista",
  "Diga: acidente à frente",
  "Diga: veículo parado",
  "Diga: objeto na pista",
  "Diga: neblina forte",
];
