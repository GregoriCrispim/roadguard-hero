import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clearVideoBuffer, formatBytes, getBufferStats } from "@/lib/video-buffer-storage";
import { CHUNK_MS, MAX_BUFFER_MS, TRIM_BLOCK_MS } from "@/lib/video-buffer-trim";
import { Camera, HardDrive, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/seguranca")({ component: Seguranca });

function Seguranca() {
  const qc = useQueryClient();
  const [clearing, setClearing] = useState(false);

  const { data: stats, isLoading } = useQuery({
    queryKey: ["video-buffer-stats"],
    queryFn: getBufferStats,
    refetchInterval: 15_000,
  });

  async function handleClear() {
    setClearing(true);
    try {
      await clearVideoBuffer();
      await qc.invalidateQueries({ queryKey: ["video-buffer-stats"] });
      toast.success("Buffer de vídeo apagado do dispositivo.");
    } catch {
      toast.error("Não foi possível apagar o buffer.");
    } finally {
      setClearing(false);
    }
  }

  const maxMin = MAX_BUFFER_MS / 60_000;
  const chunkMin = CHUNK_MS / 60_000;
  const trimMin = TRIM_BLOCK_MS / 60_000;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-3">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-red-500/10 text-red-600">
          <Camera className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-3xl font-bold">Câmera de Segurança</h1>
          <p className="text-muted-foreground">
            Gravação contínua durante a navegação, salva localmente no seu dispositivo.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={HardDrive}
          label="Buffer gravado"
          value={isLoading ? "…" : `${stats?.minutes ?? 0} min`}
          hint={`Máximo ${maxMin} min`}
        />
        <StatCard
          icon={Shield}
          label="Blocos no dispositivo"
          value={isLoading ? "…" : String(stats?.chunks ?? 0)}
          hint={`${chunkMin} min por bloco`}
        />
        <StatCard
          icon={HardDrive}
          label="Espaço usado"
          value={isLoading ? "…" : formatBytes(stats?.bytes ?? 0)}
          hint="Armazenamento local"
        />
      </div>

      <div className="rounded-2xl border bg-card p-5 text-sm text-muted-foreground space-y-3">
        <h2 className="font-display text-lg font-bold text-foreground">Como funciona</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>Ative a câmera no modo navegação (botão de vídeo no mapa).</li>
          <li>O vídeo é gravado em blocos de {chunkMin} minutos no armazenamento do dispositivo.</li>
          <li>O buffer mantém até {maxMin} minutos de gravação.</li>
          <li>
            Ao ultrapassar {maxMin} min, os {trimMin} minutos mais antigos são apagados automaticamente a cada novo bloco.
          </li>
          <li>O buffer persiste mesmo se você sair do mapa ou recarregar a página.</li>
        </ul>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          variant="destructive"
          className="gap-2"
          disabled={clearing || !stats?.chunks}
          onClick={() => void handleClear()}
        >
          <Trash2 className="h-4 w-4" />
          Apagar buffer local
        </Button>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Camera;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4">
      <Icon className="h-5 w-5 text-primary" />
      <p className="mt-2 text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
