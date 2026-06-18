import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { type Gravidade, PONTOS_POR_GRAVIDADE, pontosFromGravidade } from "@/lib/pontos";
import { assignReportConcessionaria } from "@/lib/assign-concessionaria";

const Input = z.object({
  reportId: z.string().uuid(),
  categoria: z.string(),
  descricao: z.string().optional().default(""),
});

type ReportRow = {
  id: string;
  status: string;
  gravidade: string | null;
  score_ia: number | null;
  pontos_concedidos?: number | null;
};

// Regra simulada de IA (fallback determinístico para demo)
function simulateIa(categoria: string, descricao: string): { gravidade: Gravidade; score: number; pontos: number } {
  const txt = descricao.toLowerCase();
  const palavrasCriticas = ["incêndio", "incendio", "acidente grave", "vítima", "vitima", "atropelamento", "capotamento", "fogo"];
  const palavrasAltas = ["bloqueio", "ferido", "fumaça", "fumaca", "neblina densa", "tempestade", "assalto"];

  let base: Gravidade = "media";
  if (categoria === "acidente" || categoria === "incendio" || categoria === "suspeita_assalto") base = "alta";
  if (categoria === "animal_na_pista" || categoria === "objeto_na_pista") base = "media";
  if (categoria === "clima_severo") base = "media";

  if (palavrasCriticas.some((p) => txt.includes(p))) base = "critica";
  else if (palavrasAltas.some((p) => txt.includes(p))) base = "alta";

  const score = +(0.7 + Math.random() * 0.28).toFixed(2);
  return { gravidade: base, score, pontos: PONTOS_POR_GRAVIDADE[base] };
}

async function awardPoints(
  supabase: { from: (table: string) => any },
  userId: string,
  pontos: number,
): Promise<void> {
  const { data: prof, error: profErr } = await supabase
    .from("profiles")
    .select("pontos")
    .eq("id", userId)
    .maybeSingle();

  if (profErr) throw new Error(`Falha ao ler perfil: ${profErr.message}`);

  const atual = prof?.pontos ?? 0;
  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ pontos: atual + pontos })
    .eq("id", userId);

  if (updateErr) throw new Error(`Falha ao conceder pontos: ${updateErr.message}`);
}

async function markPontosConcedidos(
  supabase: { from: (table: string) => any },
  reportId: string,
  userId: string,
  pontos: number,
): Promise<void> {
  const { error } = await supabase
    .from("reports")
    .update({ pontos_concedidos: pontos })
    .eq("id", reportId)
    .eq("user_id", userId);

  if (error && !error.message.includes("pontos_concedidos")) {
    throw new Error(`Falha ao registrar pontos do reporte: ${error.message}`);
  }
}

async function fetchReport(
  supabase: { from: (table: string) => any },
  reportId: string,
  userId: string,
): Promise<ReportRow | null> {
  const withCol = await supabase
    .from("reports")
    .select("id, status, gravidade, score_ia, pontos_concedidos")
    .eq("id", reportId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!withCol.error) return withCol.data as ReportRow | null;
  if (!withCol.error.message.includes("pontos_concedidos")) {
    throw new Error(`Falha ao buscar reporte: ${withCol.error.message}`);
  }

  const fallback = await supabase
    .from("reports")
    .select("id, status, gravidade, score_ia")
    .eq("id", reportId)
    .eq("user_id", userId)
    .maybeSingle();

  if (fallback.error) throw new Error(`Falha ao buscar reporte: ${fallback.error.message}`);
  return fallback.data as ReportRow | null;
}

export const validarOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const existing = await fetchReport(context.supabase, data.reportId, context.userId);
    if (!existing) throw new Error("Reporte não encontrado");

    const wasAlreadyValid = existing.status === "validado";
    let gravidade: Gravidade;
    let score: number;
    let pontos: number;

    if (wasAlreadyValid && existing.gravidade) {
      gravidade = existing.gravidade as Gravidade;
      score = existing.score_ia ?? 0;
      pontos = existing.pontos_concedidos ?? pontosFromGravidade(gravidade);
    } else {
      const ia = simulateIa(data.categoria, data.descricao);
      gravidade = ia.gravidade;
      score = ia.score;
      pontos = ia.pontos;

      const { error: updateErr } = await context.supabase
        .from("reports")
        .update({ gravidade, score_ia: score, status: "validado" })
        .eq("id", data.reportId)
        .eq("user_id", context.userId);

      if (updateErr) throw new Error(`Falha ao validar reporte: ${updateErr.message}`);
    }

    const jaConcedidos = existing.pontos_concedidos ?? 0;
    if (!wasAlreadyValid || jaConcedidos === 0) {
      await awardPoints(context.supabase, context.userId, pontos);
      await markPontosConcedidos(context.supabase, data.reportId, context.userId, pontos);
    } else {
      pontos = jaConcedidos;
    }

    await assignReportConcessionaria(context.supabase, data.reportId);

    return { gravidade, score, pontos };
  });
