import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ConcessionariaPedagio, ConcessionariaRota } from "@/lib/geo-scope";
import { normalizeCoordinates } from "@/lib/geo-scope";

export type AppRole = "user" | "concessionaria" | "admin" | "abcr";

export type UserRoleRow = {
  role: AppRole;
};

export type Concessionaria = {
  id: string;
  nome: string;
  sigla: string | null;
  rodovia: string | null;
  uf: string | null;
  extensao_km: number | null;
  cor: string;
  ativa: boolean;
};

export function useUserRoles() {
  return useQuery({
    queryKey: ["user-roles"],
    queryFn: async (): Promise<AppRole[]> => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
    staleTime: 60_000,
  });
}

export function useConcessionariaMembership() {
  return useQuery({
    queryKey: ["concessionaria-membership"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;

      const { data: member, error } = await supabase
        .from("concessionaria_members")
        .select("concessionaria_id, cargo, concessionarias(*)")
        .eq("user_id", u.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!member) return null;

      return {
        concessionaria_id: member.concessionaria_id,
        cargo: member.cargo,
        concessionaria: member.concessionarias as unknown as Concessionaria,
      };
    },
    staleTime: 30_000,
  });
}

export function useConcessionariaScope(concessionariaId: string | null | undefined) {
  return useQuery({
    queryKey: ["concessionaria-scope", concessionariaId],
    enabled: !!concessionariaId,
    queryFn: async () => {
      const [{ data: rotas, error: rErr }, { data: pedagios, error: pErr }] = await Promise.all([
        supabase.from("concessionaria_rotas").select("*").eq("concessionaria_id", concessionariaId!),
        supabase.from("concessionaria_pedagios").select("*").eq("concessionaria_id", concessionariaId!),
      ]);
      if (rErr) throw rErr;
      if (pErr) throw pErr;

      const rotasNorm: ConcessionariaRota[] = (rotas ?? []).map((r) => ({
        ...r,
        coordinates: normalizeCoordinates(r.coordinates),
      }));

      return {
        rotas: rotasNorm,
        pedagios: (pedagios ?? []) as ConcessionariaPedagio[],
      };
    },
    staleTime: 15_000,
  });
}

export function useIsConcessionaria() {
  const { data: roles, ...rest } = useUserRoles();
  const isConcessionaria = roles?.some((r) => r === "concessionaria" || r === "admin") ?? false;
  return { isConcessionaria, roles, ...rest };
}

export function useIsAbcr() {
  const { data: roles, ...rest } = useUserRoles();
  const isAbcr = roles?.some((r) => r === "abcr" || r === "admin") ?? false;
  return { isAbcr, roles, ...rest };
}

export async function resolvePostLoginPath(): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return "/auth";

  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", u.user.id);

  const roleList = (roles ?? []).map((r) => r.role as AppRole);
  if (roleList.includes("abcr") || roleList.includes("admin")) return "/abcr";
  if (roleList.includes("concessionaria")) return "/concessionaria";
  return "/app";
}
