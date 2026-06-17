import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  reportId: z.string().uuid(),
  categoria: z.string(),
  descricao: z.string().optional().default(""),
});

type Gravidade = "baixa" | "media" | "alta" | "critica";

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
  else if (palavrasAltas.some((p) => txt.includes(p)) && base !== "critica") base = "alta";

  const score = +(0.7 + Math.random() * 0.28).toFixed(2);
  const pontosMap: Record<Gravidade, number> = { baixa: 30, media: 60, alta: 120, critica: 200 };
  return { gravidade: base, score, pontos: pontosMap[base] };
}

export const validarOcorrencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { gravidade, score, pontos } = simulateIa(data.categoria, data.descricao);

    // Atualiza o report
    await context.supabase
      .from("reports")
      .update({ gravidade, score_ia: score, status: "validado" })
      .eq("id", data.reportId)
      .eq("user_id", context.userId);

    // Concede pontos via service role (bypassa RLS de update em profiles de outros)
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: prof } = await supabaseAdmin.from("profiles").select("pontos").eq("id", context.userId).maybeSingle();
    const atual = prof?.pontos ?? 0;
    await supabaseAdmin.from("profiles").update({ pontos: atual + pontos }).eq("id", context.userId);

    return { gravidade, score, pontos };
  });