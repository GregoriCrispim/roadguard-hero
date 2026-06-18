import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { checkReportRateLimit, REPORT_RATE_LIMITS } from "@/lib/report-rate-limit";
import { getMyRecentReportsForRateLimit } from "@/lib/submit-report";

export function useReportRateLimit(lat?: number | null, lng?: number | null) {
  const { data: recentReports, refetch } = useQuery({
    queryKey: ["my-reports-rate-limit"],
    queryFn: getMyRecentReportsForRateLimit,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });

  const result = useMemo(() => {
    if (lat == null || lng == null) {
      const inWindow = (recentReports ?? []).filter(
        (r) => Date.now() - new Date(r.created_at).getTime() < REPORT_RATE_LIMITS.timeWindowMs,
      );
      if (inWindow.length >= REPORT_RATE_LIMITS.maxInTimeWindow) {
        return {
          allowed: false as const,
          violation: "time" as const,
          message: "Limite atingido: no máximo 3 reportes a cada 2 minutos. Aguarde um pouco.",
        };
      }
      return { allowed: true as const };
    }
    return checkReportRateLimit(recentReports ?? [], lat, lng);
  }, [recentReports, lat, lng]);

  return { ...result, refetch };
}
