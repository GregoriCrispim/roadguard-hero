import { supabase } from "@/integrations/supabase/client";
import type { CategoriaKey } from "@/lib/categorias";
import { checkReportRateLimit, type ReportForRateLimit } from "@/lib/report-rate-limit";

export type SubmitReportInput = {
  categoria: CategoriaKey;
  descricao?: string;
  lat: number;
  lng: number;
  tripId?: string;
};

export class ReportRateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportRateLimitError";
  }
}

async function fetchRecentReports(userId: string): Promise<ReportForRateLimit[]> {
  const { data, error } = await supabase
    .from("reports")
    .select("latitude, longitude, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function submitReport({ categoria, descricao = "", lat, lng, tripId }: SubmitReportInput) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Sessão expirada");

  const recent = await fetchRecentReports(u.user.id);
  const limit = checkReportRateLimit(recent, lat, lng);
  if (!limit.allowed) throw new ReportRateLimitError(limit.message);

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

export async function getMyRecentReportsForRateLimit(): Promise<ReportForRateLimit[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  return fetchRecentReports(u.user.id);
}

export { checkReportRateLimit };
