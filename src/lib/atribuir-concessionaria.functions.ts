import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assignReportConcessionaria } from "@/lib/assign-concessionaria";

export const atribuirConcessionariaReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => {
    if (typeof data !== "object" || data === null || !("reportId" in data)) {
      throw new Error("reportId obrigatório");
    }
    return { reportId: String((data as { reportId: string }).reportId) };
  })
  .handler(async ({ data, context }) => {
    const concessionaria_id = await assignReportConcessionaria(context.supabase, data.reportId);
    return { concessionaria_id };
  });
