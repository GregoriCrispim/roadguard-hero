import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ConcessionariaPedagio, ConcessionariaRota } from "@/lib/geo-scope";
import { normalizeCoordinates } from "@/lib/geo-scope";

export type AppRole = "user" | "concessionaria" | "admin" | "abcr" | "partner";

export type Portal = "guardiao" | "concessionaria" | "abcr" | "parceiro";

export const PORTAL_STORAGE_KEY = "roadhero_login_portal";

const PORTAL_PATH: Record<Portal, string> = {
  guardiao: "/app",
  concessionaria: "/concessionaria",
  parceiro: "/parceiro",
  abcr: "/abcr",
};

const PORTAL_LABEL: Record<Portal, string> = {
  guardiao: "Guardião",
  concessionaria: "Concessionária",
  parceiro: "Parceiro",
  abcr: "ABCR",
};

export function portalToPath(portal: Portal): string {
  return PORTAL_PATH[portal];
}

export function portalLabel(portal: Portal): string {
  return PORTAL_LABEL[portal];
}

export function parsePortal(value: string | null | undefined): Portal {
  if (value === "concessionaria" || value === "parceiro" || value === "abcr") return value;
  return "guardiao";
}

export function canAccessPortal(roles: AppRole[], portal: Portal): boolean {
  if (roles.includes("admin")) return true;
  switch (portal) {
    case "guardiao":
      return true;
    case "concessionaria":
      return roles.includes("concessionaria");
    case "parceiro":
      return roles.includes("partner");
    case "abcr":
      return roles.includes("abcr");
  }
}

export async function fetchUserRoles(): Promise<AppRole[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  if (error) throw error;
  return (data ?? []).map((r) => r.role as AppRole);
}

export async function resolvePathForPortal(portal: Portal): Promise<string | null> {
  const roles = await fetchUserRoles();
  if (roles.length === 0) return null;
  if (!canAccessPortal(roles, portal)) return null;
  return portalToPath(portal);
}

export function storeLoginPortal(portal: Portal) {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(PORTAL_STORAGE_KEY, portal);
}

export function readStoredLoginPortal(): Portal | null {
  if (typeof sessionStorage === "undefined") return null;
  return parsePortal(sessionStorage.getItem(PORTAL_STORAGE_KEY));
}

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

/** Redirecionamento legado por prioridade de papel (evitar em fluxos de login). */
export async function resolvePostLoginPath(): Promise<string> {
  const portal = readStoredLoginPortal() ?? "guardiao";
  const path = await resolvePathForPortal(portal);
  return path ?? portalToPath("guardiao");
}
