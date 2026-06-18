import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "user" | "concessionaria" | "admin";

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

export function useIsConcessionaria() {
  const { data: roles, ...rest } = useUserRoles();
  const isConcessionaria = roles?.some((r) => r === "concessionaria" || r === "admin") ?? false;
  return { isConcessionaria, roles, ...rest };
}
