import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  tripId: z.string().uuid(),
  vehicleId: z.string().uuid(),
  amountCents: z.number().int().positive(),
  tollDetails: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      highway: z.string(),
      priceCarCents: z.number(),
    }),
  ),
});

export const payTolls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => Input.parse(data))
  .handler(async ({ data, context }) => {
    const { data: vehicle } = await context.supabase
      .from("vehicles")
      .select("id, placa")
      .eq("id", data.vehicleId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!vehicle) throw new Error("Veículo não encontrado");

    const { data: trip } = await context.supabase
      .from("trips")
      .select("id, status")
      .eq("id", data.tripId)
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!trip) throw new Error("Viagem não encontrada");
    if (trip.status !== "active") throw new Error("Viagem não está ativa");

    const paymentRef = `RH-${Date.now()}-${vehicle.placa}`;

    const { data: payment, error } = await context.supabase
      .from("toll_payments")
      .insert({
        user_id: context.userId,
        trip_id: data.tripId,
        vehicle_id: data.vehicleId,
        amount_cents: data.amountCents,
        toll_details: data.tollDetails,
        status: "paid",
        payment_ref: paymentRef,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      paymentId: payment.id,
      paymentRef,
      placa: vehicle.placa,
      amountCents: data.amountCents,
    };
  });
