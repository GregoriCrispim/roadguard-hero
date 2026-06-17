import { createServerFn } from "@tanstack/react-start";
import { generateObject } from "ai";
import { z } from "zod";
import { createGeminiProvider } from "@/lib/ai-gateway.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { CategoriaKey } from "@/lib/categorias";
import { inferReportFromNaturalSpeech, parseVoiceCommand } from "@/lib/voice-commands";

const CATEGORIAS = [
  "animal_na_pista",
  "veiculo_parado",
  "acidente",
  "objeto_na_pista",
  "incendio",
  "risco_seguranca",
  "clima_severo",
  "suspeita_assalto",
] as const;

const Input = z.object({ text: z.string().min(2).max(500) });

const OutputSchema = z.object({
  is_report: z.boolean(),
  categoria: z.enum(CATEGORIAS).nullable(),
  descricao: z.string(),
  confianca: z.number().min(0).max(1),
});

export type InterpretedVoiceReport = {
  isReport: boolean;
  categoria: CategoriaKey | null;
  descricao: string;
  confianca: number;
  source: "regex" | "ai" | "none";
};

export const interpretVoiceReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data }): Promise<InterpretedVoiceReport> => {
    const text = data.text.trim();
    const local = parseVoiceCommand(text);

    if (local.type === "cancel") {
      return { isReport: false, categoria: null, descricao: text, confianca: 1, source: "regex" };
    }

    if (local.type === "categoria") {
      return {
        isReport: true,
        categoria: local.categoria,
        descricao: text,
        confianca: 0.95,
        source: "regex",
      };
    }

    const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
      const inferred = inferReportFromNaturalSpeech(text);
      if (inferred) {
        return {
          isReport: true,
          categoria: inferred.categoria,
          descricao: text,
          confianca: inferred.confianca,
          source: "regex",
        };
      }
      return { isReport: false, categoria: null, descricao: text, confianca: 0, source: "none" };
    }

    try {
      const gemini = createGeminiProvider(key);
      const { object } = await generateObject({
        model: gemini("gemini-2.0-flash"),
        schema: OutputSchema,
        prompt: `Você analisa falas de motoristas em português do Brasil para reportar ocorrências na rodovia.

Fala do motorista: """${text}"""

Categorias (use exatamente uma chave ou null):
- animal_na_pista: animal, cavalo, cachorro, boi, fauna na pista
- veiculo_parado: carro/veículo/caminhão parado, pane, carro quebrado
- acidente: batida, colisão, capotamento, engavetamento, atropelamento
- objeto_na_pista: objeto, carga, pneu, entulho, obstáculo na via
- incendio: fogo, incêndio, queimada, chamas
- risco_seguranca: buraco, pista perigosa, sinalização, risco
- clima_severo: chuva forte, neblina, alagamento, tempestade, granizo
- suspeita_assalto: assalto, roubo, suspeito, abordagem

Regras:
- is_report=true se o motorista descreve uma ocorrência real na via (mesmo em linguagem natural como "tem um cavalo ali na frente").
- is_report=false para cumprimentos, perguntas, ruído ou pedidos genéricos sem ocorrência.
- descricao: resumo curto em português do que foi reportado.
- confianca: 0 a 1.`,
      });

      return {
        isReport: object.is_report,
        categoria: object.categoria,
        descricao: object.descricao || text,
        confianca: object.confianca,
        source: "ai",
      };
    } catch {
      const inferred = inferReportFromNaturalSpeech(text);
      if (inferred) {
        return {
          isReport: true,
          categoria: inferred.categoria,
          descricao: text,
          confianca: inferred.confianca * 0.9,
          source: "regex",
        };
      }
      return { isReport: false, categoria: null, descricao: text, confianca: 0, source: "none" };
    }
  });
