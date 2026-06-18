import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useIsPartner, usePartnerMembership } from "@/hooks/usePartnerRole";
import { validarResgate } from "@/lib/resgate-recompensa.functions";
import { QrScanner } from "@/components/parceiro/QrScanner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Building2, Gift, Loader2, Plus, QrCode, Save, ScanLine, Trash2, Users,
} from "lucide-react";
import type { Partner } from "@/hooks/usePartnerRole";

export const Route = createFileRoute("/_authenticated/parceiro")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
    const allowed = roles?.some((r) => r.role === "partner" || r.role === "admin");
    if (!allowed) throw redirect({ to: "/painel" });
  },
  component: ParceiroPage,
});

type Reward = {
  id: string;
  nome: string;
  descricao: string | null;
  custo_pontos: number;
  categoria: string | null;
  ativo: boolean;
  partner_id: string | null;
};

function ParceiroPage() {
  const { isPartner, isLoading: loadingRole } = useIsPartner();
  const { data: membership, isLoading: loadingMember } = usePartnerMembership();

  if (loadingRole || loadingMember) {
    return <p className="text-sm text-muted-foreground">Carregando portal do parceiro...</p>;
  }
  if (!isPartner) return null;
  if (!membership) return <PartnerOnboarding />;

  return <PartnerDashboard membership={membership} />;
}

function PartnerOnboarding() {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [razao, setRazao] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState("geral");

  const register = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("registrar_parceiro", {
        p_nome_fantasia: nome,
        p_razao_social: razao || null,
        p_cnpj: cnpj || null,
        p_telefone: telefone || null,
        p_email_contato: email || null,
        p_cidade: cidade || null,
        p_uf: uf || null,
        p_descricao: descricao || null,
        p_categoria: categoria,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      toast.success("Empresa parceira cadastrada!");
      void qc.invalidateQueries({ queryKey: ["partner-membership"] });
      void qc.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8">
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="font-display text-2xl font-bold">Cadastre sua empresa</h1>
          <p className="text-sm text-muted-foreground">Disponibilize recompensas para os guardiões RoadHero.</p>
        </div>
      </div>
      <form
        className="mt-6 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          register.mutate();
        }}
      >
        <div><Label>Nome fantasia *</Label><Input required value={nome} onChange={(e) => setNome(e.target.value)} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Razão social</Label><Input value={razao} onChange={(e) => setRazao(e.target.value)} /></div>
          <div><Label>CNPJ</Label><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></div>
          <div><Label>E-mail comercial</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><Label>Cidade</Label><Input value={cidade} onChange={(e) => setCidade(e.target.value)} /></div>
          <div><Label>UF</Label><Input maxLength={2} value={uf} onChange={(e) => setUf(e.target.value)} /></div>
        </div>
        <div>
          <Label>Categoria</Label>
          <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={categoria} onChange={(e) => setCategoria(e.target.value)}>
            <option value="combustivel">Combustível</option>
            <option value="alimentacao">Alimentação</option>
            <option value="pedagio">Pedágio</option>
            <option value="brinde">Brinde</option>
            <option value="geral">Geral</option>
          </select>
        </div>
        <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} /></div>
        <Button type="submit" disabled={register.isPending} className="w-full gap-2">
          {register.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Cadastrar empresa parceira
        </Button>
      </form>
    </div>
  );
}

function PartnerDashboard({ membership }: { membership: { partner_id: string; cargo: string; partner: Partner } }) {
  const qc = useQueryClient();
  const validar = useServerFn(validarResgate);
  const partner = membership.partner;
  const isGestor = membership.cargo === "gestor";

  const { data: rewards = [] } = useQuery({
    queryKey: ["partner-rewards", membership.partner_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rewards")
        .select("*")
        .eq("partner_id", membership.partner_id)
        .order("custo_pontos");
      if (error) throw error;
      return (data ?? []) as Reward[];
    },
  });

  const [codigoManual, setCodigoManual] = useState("");
  const [scanning, setScanning] = useState(true);

  const validarCodigo = useMutation({
    mutationFn: async (codigo: string) => validar({ data: { codigo } }),
    onSuccess: (res) => {
      toast.success(`Resgate validado: ${res.reward_nome} (−${res.pontos_gastos} pts do motorista)`);
      setCodigoManual("");
      void qc.invalidateQueries({ queryKey: ["partner-redemptions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10">
          <Building2 className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">{partner.nome_fantasia}</h1>
          <p className="text-muted-foreground">Portal do parceiro · {isGestor ? "Gestor" : "Funcionário"}</p>
        </div>
      </div>

      <Tabs defaultValue="validar">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="validar" className="gap-1"><ScanLine className="h-4 w-4" /> Validar QR</TabsTrigger>
          <TabsTrigger value="recompensas" className="gap-1"><Gift className="h-4 w-4" /> Recompensas</TabsTrigger>
          {isGestor && <TabsTrigger value="empresa" className="gap-1"><Building2 className="h-4 w-4" /> Empresa</TabsTrigger>}
          {isGestor && <TabsTrigger value="equipe" className="gap-1"><Users className="h-4 w-4" /> Equipe</TabsTrigger>}
        </TabsList>

        <TabsContent value="validar" className="space-y-4">
          <div className="rounded-2xl border bg-card p-5 space-y-4">
            <h3 className="font-display font-bold flex items-center gap-2"><QrCode className="h-5 w-5" /> Leitura do código QR</h3>
            <p className="text-sm text-muted-foreground">
              Escaneie o QR do motorista ou digite o código manualmente. Só é possível validar recompensas cadastradas por esta empresa.
            </p>
            {scanning ? <QrScanner onScan={(c) => validarCodigo.mutate(c)} /> : null}
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setScanning((s) => !s)}>
                {scanning ? "Pausar câmera" : "Ativar câmera"}
              </Button>
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="RH-XXXXXXXX"
                value={codigoManual}
                onChange={(e) => setCodigoManual(e.target.value.toUpperCase())}
                className="font-mono"
              />
              <Button
                disabled={!codigoManual.trim() || validarCodigo.isPending}
                onClick={() => validarCodigo.mutate(codigoManual.trim())}
              >
                {validarCodigo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Validar"}
              </Button>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recompensas">
          <RewardsManager partnerId={membership.partner_id} rewards={rewards} isGestor={isGestor} />
        </TabsContent>

        {isGestor && (
          <TabsContent value="empresa">
            <CompanyForm partner={partner} />
          </TabsContent>
        )}

        {isGestor && (
          <TabsContent value="equipe">
            <TeamManager partnerId={membership.partner_id} />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function RewardsManager({ partnerId, rewards, isGestor }: { partnerId: string; rewards: Reward[]; isGestor: boolean }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [custo, setCusto] = useState("");
  const [categoria, setCategoria] = useState("geral");

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rewards").insert({
        partner_id: partnerId,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        custo_pontos: parseInt(custo, 10) || 0,
        categoria,
        ativo: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recompensa cadastrada");
      setNome(""); setDescricao(""); setCusto("");
      void qc.invalidateQueries({ queryKey: ["partner-rewards", partnerId] });
      void qc.invalidateQueries({ queryKey: ["rewards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("rewards").update({ ativo: !ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["partner-rewards", partnerId] });
      void qc.invalidateQueries({ queryKey: ["rewards"] });
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rewards").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Recompensa removida");
      void qc.invalidateQueries({ queryKey: ["partner-rewards", partnerId] });
      void qc.invalidateQueries({ queryKey: ["rewards"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {isGestor && (
        <div className="rounded-2xl border bg-card p-5 space-y-3">
          <h3 className="font-display font-bold">Nova recompensa</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Nome</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
            <div><Label>Custo (pontos)</Label><Input type="number" value={custo} onChange={(e) => setCusto(e.target.value)} /></div>
          </div>
          <div><Label>Descrição</Label><Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={2} /></div>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !nome.trim()} className="gap-2">
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Cadastrar recompensa
          </Button>
        </div>
      )}

      <ul className="divide-y rounded-2xl border">
        {rewards.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-4 px-4 py-4">
            <div>
              <p className="font-medium">{r.nome}</p>
              <p className="text-xs text-muted-foreground">{r.descricao}</p>
              <p className="mt-1 text-sm font-semibold text-primary">{r.custo_pontos} pts</p>
            </div>
            {isGestor && (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => toggle.mutate({ id: r.id, ativo: r.ativo })}>
                  {r.ativo ? "Desativar" : "Ativar"}
                </Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(r.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </li>
        ))}
        {rewards.length === 0 && (
          <li className="px-4 py-8 text-center text-muted-foreground">Nenhuma recompensa cadastrada.</li>
        )}
      </ul>
    </div>
  );
}

function CompanyForm({ partner }: { partner: Partner }) {
  const qc = useQueryClient();
  const [form, setForm] = useState(partner);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("partners").update({
        nome_fantasia: form.nome_fantasia,
        razao_social: form.razao_social,
        cnpj: form.cnpj,
        telefone: form.telefone,
        email_contato: form.email_contato,
        endereco: form.endereco,
        cidade: form.cidade,
        uf: form.uf,
        descricao: form.descricao,
        categoria: form.categoria,
        updated_at: new Date().toISOString(),
      }).eq("id", partner.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dados da empresa atualizados");
      void qc.invalidateQueries({ queryKey: ["partner-membership"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = (k: keyof Partner, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <h3 className="font-display font-bold">Dados da empresa</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Nome fantasia</Label><Input value={form.nome_fantasia} onChange={(e) => set("nome_fantasia", e.target.value)} /></div>
        <div><Label>Razão social</Label><Input value={form.razao_social ?? ""} onChange={(e) => set("razao_social", e.target.value)} /></div>
        <div><Label>CNPJ</Label><Input value={form.cnpj ?? ""} onChange={(e) => set("cnpj", e.target.value)} /></div>
        <div><Label>Telefone</Label><Input value={form.telefone ?? ""} onChange={(e) => set("telefone", e.target.value)} /></div>
      </div>
      <div><Label>Descrição</Label><Textarea value={form.descricao ?? ""} onChange={(e) => set("descricao", e.target.value)} rows={3} /></div>
      <Button onClick={() => save.mutate()} disabled={save.isPending} className="gap-2">
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar
      </Button>
    </div>
  );
}

function TeamManager({ partnerId }: { partnerId: string }) {
  const qc = useQueryClient();
  const [userId, setUserId] = useState("");
  const [cargo, setCargo] = useState("funcionario");

  const { data: members = [] } = useQuery({
    queryKey: ["partner-team", partnerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_members")
        .select("user_id, cargo, profiles(nome)")
        .eq("partner_id", partnerId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!userId.trim()) throw new Error("Informe o ID do usuário");
      await supabase.from("user_roles").upsert({ user_id: userId.trim(), role: "partner" }, { onConflict: "user_id,role" });
      const { error } = await supabase.from("partner_members").insert({
        user_id: userId.trim(),
        partner_id: partnerId,
        cargo,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Funcionário vinculado");
      setUserId("");
      void qc.invalidateQueries({ queryKey: ["partner-team", partnerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <h3 className="font-display font-bold">Adicionar funcionário</h3>
        <p className="text-sm text-muted-foreground">O funcionário precisa ter conta RoadHero. Informe o UUID do usuário.</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2"><Label>ID do usuário</Label><Input value={userId} onChange={(e) => setUserId(e.target.value)} /></div>
          <div>
            <Label>Cargo</Label>
            <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={cargo} onChange={(e) => setCargo(e.target.value)}>
              <option value="funcionario">Funcionário</option>
              <option value="gestor">Gestor</option>
            </select>
          </div>
        </div>
        <Button onClick={() => add.mutate()} disabled={add.isPending} className="gap-2">
          <Users className="h-4 w-4" /> Vincular
        </Button>
      </div>
      <ul className="divide-y rounded-2xl border">
        {members.map((m) => (
          <li key={m.user_id} className="flex justify-between px-4 py-3 text-sm">
            <span>{(m.profiles as { nome: string } | null)?.nome ?? m.user_id}</span>
            <span className="text-muted-foreground">{m.cargo}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
