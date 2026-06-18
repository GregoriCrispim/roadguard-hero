import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const ResgatarInput = z.object({ rewardId: z.string().uuid() });
const ValidarInput = z.object({ codigo: z.string().min(4) });

export type ResgateCriado = {
  id: string;
  codigo: string;
  expires_at: string;
  pontos_gastos: number;
  reward_nome: string;
};

export type ResgateValidado = {
  id: string;
  codigo: string;
  reward_nome: string;
  pontos_gastos: number;
  user_id: string;
};

export const resgatarRecompensa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ResgatarInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("criar_resgate", {
      p_reward_id: data.rewardId,
    });
    if (error) throw new Error(error.message);
    return result as ResgateCriado;
  });

export const validarResgate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => ValidarInput.parse(d))
  .handler(async ({ context, data }) => {
    const { data: result, error } = await context.supabase.rpc("validar_resgate", {
      p_codigo: data.codigo.trim().toUpperCase(),
    });
    if (error) throw new Error(error.message);
    return result as ResgateValidado;
  });
