import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { type Gravidade, PONTOS_POR_GRAVIDADE, pontosFromGravidade } from "@/lib/pontos";

const Input = z.object({
  reportId: z.string().uuid(),
  categoria: z.string(),
  descricao: z.string().optional().default(""),
});

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

export const validarOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: existing, error: fetchErr } = await context.supabase
      .from("reports")
      .select("id, status, gravidade, score_ia, pontos_concedidos")
      .eq("id", data.reportId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (fetchErr) throw new Error(`Falha ao buscar reporte: ${fetchErr.message}`);
    if (!existing) throw new Error("Reporte não encontrado");

    let gravidade: Gravidade;
    let score: number;
    let pontos: number;

    if (existing.status === "validado" && existing.gravidade) {
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
    if (jaConcedidos === 0) {
      await awardPoints(context.supabase, context.userId, pontos);

      const { error: markErr } = await context.supabase
        .from("reports")
        .update({ pontos_concedidos: pontos })
        .eq("id", data.reportId)
        .eq("user_id", context.userId);

      if (markErr) throw new Error(`Falha ao registrar pontos do reporte: ${markErr.message}`);
    } else {
      pontos = jaConcedidos;
    }

    return { gravidade, score, pontos };
  });
