import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CATEGORIAS_LIST, type CategoriaKey } from "@/lib/categorias";
import { toast } from "sonner";
import { Loader2, MapPin, Camera } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { validarOcorrencia } from "@/lib/validar-ocorrencia.functions";

export const Route = createFileRoute("/_authenticated/reportar")({
  component: Reportar,
});

function Reportar() {
  const nav = useNavigate();
  const validar = useServerFn(validarOcorrencia);
  const [categoria, setCategoria] = useState<CategoriaKey | null>(null);
  const [descricao, setDescricao] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  function getLocation() {
    if (!navigator.geolocation) return toast.error("GPS indisponível");
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => toast.error("Não foi possível obter localização"),
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!categoria) return toast.error("Selecione uma categoria");
    if (!coords) return toast.error("Capture sua localização");
    setLoading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Sessão expirada");

      let foto_url: string | null = null;
      if (foto) {
        const path = `${u.user.id}/${Date.now()}-${foto.name}`;
        const { error } = await supabase.storage.from("report-photos").upload(path, foto);
        if (!error) foto_url = path;
      }

      const { data: r, error } = await supabase.from("reports").insert({
        user_id: u.user.id,
        categoria,
        descricao,
        latitude: coords.lat,
        longitude: coords.lng,
        foto_url,
      }).select().single();
      if (error) throw error;

      toast.loading("IA analisando ocorrência...", { id: "ia" });
      const res = await validar({ data: { reportId: r.id, categoria, descricao } });
      toast.success(`Validado! Gravidade ${res.gravidade} · +${res.pontos} pontos`, { id: "ia" });
      nav({ to: "/app" });
    } catch (e: any) {
      toast.error(e.message ?? "Erro ao reportar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-3xl font-bold">Nova ocorrência</h1>
      <p className="text-muted-foreground">Seu reporte chega em segundos ao centro de controle.</p>
      <form onSubmit={submit} className="mt-6 space-y-6">
        <div>
          <Label>Categoria</Label>
          <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {CATEGORIAS_LIST.map((c) => {
              const Icon = c.icon;
              const active = categoria === c.key;
              return (
                <button key={c.key} type="button" onClick={() => setCategoria(c.key)}
                  className={`flex flex-col items-center gap-2 rounded-xl border p-3 text-xs transition ${active ? "border-primary bg-primary/10" : "hover:border-primary/40 hover:bg-surface"}`}>
                  <Icon className="h-5 w-5" style={{ color: c.cor }} />
                  <span className="text-center font-medium">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <Label htmlFor="desc">Descrição</Label>
          <Textarea id="desc" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Conte rapidamente o que viu..." />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Localização GPS</Label>
            <Button type="button" variant="outline" onClick={getLocation} className="mt-2 w-full gap-2">
              <MapPin className="h-4 w-4" /> {coords ? `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}` : "Capturar localização"}
            </Button>
          </div>
          <div>
            <Label htmlFor="foto">Foto (opcional)</Label>
            <label htmlFor="foto" className="mt-2 flex h-9 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm">
              <Camera className="h-4 w-4" /> {foto ? foto.name.slice(0, 24) : "Adicionar foto"}
            </label>
            <input id="foto" type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => setFoto(e.target.files?.[0] ?? null)} />
          </div>
        </div>

        <Button type="submit" disabled={loading} size="lg" className="w-full gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar reporte"}
        </Button>
      </form>
    </div>
  );
}