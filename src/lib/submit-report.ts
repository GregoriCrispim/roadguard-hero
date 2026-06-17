import { supabase } from "@/integrations/supabase/client";
import type { CategoriaKey } from "@/lib/categorias";

export type SubmitReportInput = {
  categoria: CategoriaKey;
  descricao?: string;
  lat: number;
  lng: number;
  tripId?: string;
};

export async function submitReport({ categoria, descricao = "", lat, lng, tripId }: SubmitReportInput) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada");

  const { data: r, error } = await supabase
    .from("reports")
    .insert({
      user_id: u.user.id,
      categoria,
      descricao,
      latitude: lat,
      longitude: lng,
      foto_url: null,
      trip_id: tripId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return r;
}
