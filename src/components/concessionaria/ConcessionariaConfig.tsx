import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RouteEditorMap } from "@/components/concessionaria/RouteEditorMap";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Save, Trash2 } from "lucide-react";
import type { ConcessionariaPedagio, ConcessionariaRota } from "@/lib/geo-scope";
import { normalizeCoordinates } from "@/lib/geo-scope";

type Props = {
  concessionariaId: string;
  rotas: ConcessionariaRota[];
  pedagios: ConcessionariaPedagio[];
};

export function ConcessionariaConfig({ concessionariaId, rotas, pedagios }: Props) {
  const qc = useQueryClient();
  const rota = rotas[0];
  const [coords, setCoords] = useState<[number, number][]>(
    () => normalizeCoordinates(rota?.coordinates ?? []),
  );
  const [buffer, setBuffer] = useState(rota?.buffer_metros ?? 2000);
  const [nomeRota, setNomeRota] = useState(rota?.nome ?? "Trecho principal");

  const [pedNome, setPedNome] = useState("");
  const [pedKm, setPedKm] = useState("");
  const [pedLat, setPedLat] = useState("");
  const [pedLng, setPedLng] = useState("");
  const [pedPreco, setPedPreco] = useState("");
  const [pedRaio, setPedRaio] = useState("1500");

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["concessionaria-scope", concessionariaId] });
  };

  const saveRota = useMutation({
    mutationFn: async () => {
      if (coords.length < 2) throw new Error("Adicione pelo menos 2 pontos na rota");
      const payload = {
        concessionaria_id: concessionariaId,
        nome: nomeRota,
        coordinates: coords,
        buffer_metros: buffer,
        updated_at: new Date().toISOString(),
      };
      if (rota?.id) {
        const { error } = await supabase.from("concessionaria_rotas").update(payload).eq("id", rota.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("concessionaria_rotas").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Rota da via pedagiada salva");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPedagio = useMutation({
    mutationFn: async () => {
      const lat = parseFloat(pedLat);
      const lng = parseFloat(pedLng);
      const preco = Math.round(parseFloat(pedPreco.replace(",", ".")) * 100) || 0;
      const raio = parseInt(pedRaio, 10) || 1500;
      if (!pedNome.trim()) throw new Error("Nome do pedágio obrigatório");
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error("Coordenadas inválidas");

      const { error } = await supabase.from("concessionaria_pedagios").insert({
        concessionaria_id: concessionariaId,
        nome: pedNome.trim(),
        km: pedKm.trim() || null,
        latitude: lat,
        longitude: lng,
        preco_carro_centavos: preco,
        raio_metros: raio,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedágio cadastrado");
      setPedNome("");
      setPedKm("");
      setPedLat("");
      setPedLng("");
      setPedPreco("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removePedagio = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("concessionaria_pedagios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pedágio removido");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function captureGpsForPedagio() {
    if (!navigator.geolocation) return toast.error("GPS indisponível");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setPedLat(p.coords.latitude.toFixed(6));
        setPedLng(p.coords.longitude.toFixed(6));
      },
      () => toast.error("Não foi possível obter localização"),
    );
  }

  return (
    <div className="space-y-8">
      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <div>
          <h3 className="font-display text-lg font-bold">Rota da via pedagiada</h3>
          <p className="text-sm text-muted-foreground">
            Defina o traçado do trecho concedido. Alertas dentro do corredor (buffer) serão exibidos para sua concessionária.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label htmlFor="nome-rota">Nome do trecho</Label>
            <Input id="nome-rota" value={nomeRota} onChange={(e) => setNomeRota(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="buffer">Buffer (metros)</Label>
            <Input id="buffer" type="number" min={500} max={10000} value={buffer} onChange={(e) => setBuffer(Number(e.target.value))} />
          </div>
        </div>
        <RouteEditorMap
          coordinates={coords}
          pedagios={pedagios.map((p) => ({ lat: p.latitude, lng: p.longitude, nome: p.nome }))}
          onChange={setCoords}
        />
        <Button onClick={() => saveRota.mutate()} disabled={saveRota.isPending} className="gap-2">
          {saveRota.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar rota
        </Button>
      </section>

      <section className="space-y-4 rounded-2xl border bg-card p-5">
        <div>
          <h3 className="font-display text-lg font-bold">Pedágios</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre praças de pedágio. Alertas no raio de cada praça também entram no seu escopo.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label>Nome</Label>
            <Input value={pedNome} onChange={(e) => setPedNome(e.target.value)} placeholder="Ex.: Praça Norte" />
          </div>
          <div>
            <Label>Km</Label>
            <Input value={pedKm} onChange={(e) => setPedKm(e.target.value)} placeholder="Ex.: km 142" />
          </div>
          <div>
            <Label>Preço carro (R$)</Label>
            <Input value={pedPreco} onChange={(e) => setPedPreco(e.target.value)} placeholder="12,50" />
          </div>
          <div>
            <Label>Latitude</Label>
            <Input value={pedLat} onChange={(e) => setPedLat(e.target.value)} />
          </div>
          <div>
            <Label>Longitude</Label>
            <Input value={pedLng} onChange={(e) => setPedLng(e.target.value)} />
          </div>
          <div>
            <Label>Raio de cobertura (m)</Label>
            <Input value={pedRaio} onChange={(e) => setPedRaio(e.target.value)} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={captureGpsForPedagio} className="gap-2">
            <MapPin className="h-4 w-4" /> Usar GPS atual
          </Button>
          <Button onClick={() => addPedagio.mutate()} disabled={addPedagio.isPending} className="gap-2">
            {addPedagio.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar pedágio
          </Button>
        </div>

        {pedagios.length > 0 && (
          <ul className="divide-y rounded-xl border">
            {pedagios.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <p className="font-medium">{p.nome}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.km ? `${p.km} · ` : ""}
                    {p.latitude.toFixed(4)}, {p.longitude.toFixed(4)} · raio {p.raio_metros}m
                    {p.preco_carro_centavos > 0 && ` · R$ ${(p.preco_carro_centavos / 100).toFixed(2)}`}
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => removePedagio.mutate(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
