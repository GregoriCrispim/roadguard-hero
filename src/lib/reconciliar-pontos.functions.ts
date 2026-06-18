import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { pontosFromGravidade } from "@/lib/pontos";

/** Corrige reportes validados que não concederam pontos (ex.: falha silenciosa anterior). */
export const reconciliarPontos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: pendentes, error: listErr } = await context.supabase
      .from("reports")
      .select("id, gravidade, pontos_concedidos")
      .eq("user_id", context.userId)
      .eq("status", "validado")
      .eq("pontos_concedidos", 0);

    if (listErr) throw new Error(`Falha ao buscar reportes: ${listErr.message}`);
    if (!pendentes?.length) return { corrigidos: 0, pontosAdicionados: 0 };

    let pontosAdicionados = 0;

    for (const report of pendentes) {
      const pontos = pontosFromGravidade(report.gravidade);
      if (pontos <= 0) continue;

      const { data: prof, error: profErr } = await context.supabase
        .from("profiles")
        .select("pontos")
        .eq("id", context.userId)
        .maybeSingle();

      if (profErr) continue;

      const atual = prof?.pontos ?? 0;
      const { error: pointsErr } = await context.supabase
        .from("profiles")
        .update({ pontos: atual + pontos })
        .eq("id", context.userId);

      if (pointsErr) continue;

      const { error: markErr } = await context.supabase
        .from("reports")
        .update({ pontos_concedidos: pontos })
        .eq("id", report.id)
        .eq("user_id", context.userId);

      if (markErr) continue;

      pontosAdicionados += pontos;
    }

    return { corrigidos: pendentes.length, pontosAdicionados };
  });
