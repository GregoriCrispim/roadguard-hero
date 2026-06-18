import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Partner = {
  id: string;
  nome_fantasia: string;
  razao_social: string | null;
  cnpj: string | null;
  telefone: string | null;
  email_contato: string | null;
  endereco: string | null;
  cidade: string | null;
  uf: string | null;
  descricao: string | null;
  categoria: string | null;
  ativo: boolean;
};

export function useIsPartner() {
  const { data: roles, ...rest } = useQuery({
    queryKey: ["user-roles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as string);
    },
    staleTime: 60_000,
  });
  const isPartner = roles?.some((r) => r === "partner" || r === "admin") ?? false;
  return { isPartner, roles, ...rest };
}

export function usePartnerMembership() {
  return useQuery({
    queryKey: ["partner-membership"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return null;

      const { data: member, error } = await supabase
        .from("partner_members")
        .select("partner_id, cargo, partners(*)")
        .eq("user_id", u.user.id)
        .maybeSingle();

      if (error) throw error;
      if (!member) return null;

      return {
        partner_id: member.partner_id,
        cargo: member.cargo as "gestor" | "funcionario",
        partner: member.partners as unknown as Partner,
      };
    },
    staleTime: 30_000,
  });
}
