import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isValidPlaca, normalizePlaca } from "@/lib/tolls";
import { toast } from "sonner";
import { ArrowLeft, Car, Loader2, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/veiculos")({
  component: VeiculosPage,
});

function VeiculosPage() {
  const qc = useQueryClient();
  const [placa, setPlaca] = useState("");
  const [apelido, setApelido] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["vehicles"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return [];
      const { data } = await supabase
        .from("vehicles")
        .select("*")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  async function addVehicle(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizePlaca(placa);
    if (!isValidPlaca(normalized)) {
      return toast.error("Placa inválida. Use formato ABC1D23 ou ABC1234");
    }
    setSaving(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");
      const { error } = await supabase.from("vehicles").insert({
        user_id: u.user.id,
        placa: normalized,
        apelido: apelido.trim() || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Esta placa já está cadastrada");
        throw error;
      }
      setPlaca("");
      setApelido("");
      qc.invalidateQueries({ queryKey: ["vehicles"] });
      toast.success("Veículo cadastrado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao cadastrar");
    } finally {
      setSaving(false);
    }
  }

  async function removeVehicle(id: string) {
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return toast.error("Não foi possível remover");
    qc.invalidateQueries({ queryKey: ["vehicles"] });
    toast.success("Veículo removido");
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link to="/app" className="grid h-10 w-10 place-items-center rounded-full border">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="font-display text-2xl font-bold">Meus veículos</h1>
          <p className="text-sm text-muted-foreground">Cadastre placas para pagamento de pedágio.</p>
        </div>
      </div>

      <form onSubmit={addVehicle} className="space-y-4 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-2 text-primary">
          <Car className="h-5 w-5" />
          <h2 className="font-semibold">Novo veículo</h2>
        </div>
        <div>
          <Label htmlFor="placa">Placa</Label>
          <Input
            id="placa"
            value={placa}
            onChange={(e) => setPlaca(e.target.value.toUpperCase())}
            placeholder="ABC1D23"
            maxLength={8}
            className="mt-1 uppercase"
          />
        </div>
        <div>
          <Label htmlFor="apelido">Apelido (opcional)</Label>
          <Input
            id="apelido"
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            placeholder="Ex: Carro da família"
            className="mt-1"
          />
        </div>
        <Button type="submit" disabled={saving} className="w-full gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Adicionar veículo
        </Button>
      </form>

      <div className="rounded-2xl border bg-card p-5">
        <h2 className="font-semibold">Veículos cadastrados</h2>
        {isLoading && <p className="mt-3 text-sm text-muted-foreground">Carregando...</p>}
        {!isLoading && !vehicles?.length && (
          <p className="mt-3 text-sm text-muted-foreground">Nenhum veículo cadastrado ainda.</p>
        )}
        <ul className="mt-4 divide-y">
          {vehicles?.map((v) => (
            <li key={v.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-mono font-bold tracking-wider">{v.placa}</p>
                {v.apelido && <p className="text-sm text-muted-foreground">{v.apelido}</p>}
              </div>
              <Button variant="ghost" size="icon" onClick={() => removeVehicle(v.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
