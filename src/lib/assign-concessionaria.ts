import {
  findConcessionariaForPoint,
  normalizeCoordinates,
  type ConcessionariaPedagio,
  type ConcessionariaRota,
} from "@/lib/geo-scope";

type SupabaseClient = {
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, val: string) => {
        maybeSingle: () => Promise<{ data: { id: string; latitude: number; longitude: number; concessionaria_id: string | null } | null; error: { message: string } | null }>;
      };
    };
    update: (vals: object) => { eq: (col: string, val: string) => Promise<{ error: { message: string } | null }> };
  };
};

export async function assignReportConcessionaria(
  supabase: SupabaseClient,
  reportId: string,
): Promise<string | null> {
  const { data: report, error: repErr } = await supabase
    .from("reports")
    .select("id, latitude, longitude, concessionaria_id")
    .eq("id", reportId)
    .maybeSingle();

  if (repErr || !report) return null;
  if (report.concessionaria_id) return report.concessionaria_id;

  const { data: concs } = await (supabase as any)
    .from("concessionarias")
    .select("id")
    .eq("ativa", true);

  if (!concs?.length) return null;

  const configs = await Promise.all(
    concs.map(async (c: { id: string }) => {
      const [{ data: rotas }, { data: pedagios }] = await Promise.all([
        (supabase as any).from("concessionaria_rotas").select("*").eq("concessionaria_id", c.id),
        (supabase as any).from("concessionaria_pedagios").select("*").eq("concessionaria_id", c.id),
      ]);
      return {
        concessionaria_id: c.id,
        rotas: (rotas ?? []).map((r: ConcessionariaRota) => ({
          ...r,
          coordinates: normalizeCoordinates(r.coordinates),
        })) as ConcessionariaRota[],
        pedagios: (pedagios ?? []) as ConcessionariaPedagio[],
      };
    }),
  );

  const concessionaria_id = findConcessionariaForPoint(
    report.latitude,
    report.longitude,
    configs,
  );

  if (concessionaria_id) {
    await supabase.from("reports").update({ concessionaria_id }).eq("id", report.id);
  }

  return concessionaria_id;
}
