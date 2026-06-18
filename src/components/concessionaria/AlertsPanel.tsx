import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORIAS, GRAVIDADE_COR, type CategoriaKey } from "@/lib/categorias";
import type { ReportRow } from "@/lib/concessionaria-stats";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Trash2, XCircle } from "lucide-react";

type ReportStatus = ReportRow["status"];

const STATUS_LABEL: Record<ReportStatus, string> = {
  em_analise: "Em análise",
  validado: "Validado",
  resolvido: "Resolvido",
  descartado: "Descartado",
};

type Props = {
  reports: ReportRow[];
  filter?: ReportStatus | "todos" | "criticos";
};

export function AlertsPanel({ reports, filter = "todos" }: Props) {
  const qc = useQueryClient();

  const filtered = reports.filter((r) => {
    if (filter === "criticos") {
      return r.gravidade === "critica" && r.status !== "resolvido" && r.status !== "descartado";
    }
    if (filter === "todos") return true;
    return r.status === filter;
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ReportStatus }) => {
      const { error } = await supabase.from("reports").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["concessionaria-reports"] });
      void qc.invalidateQueries({ queryKey: ["reports-all"] });
      toast.success("Alerta atualizado");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!filtered.length) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Nenhum alerta neste filtro.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ocorrência</TableHead>
            <TableHead>Gravidade</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Quando</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.map((r) => {
            const cat = CATEGORIAS[r.categoria as CategoriaKey];
            const busy = updateStatus.isPending && updateStatus.variables?.id === r.id;
            return (
              <TableRow key={r.id}>
                <TableCell>
                  <p className="font-medium">{cat?.label ?? r.categoria}</p>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{r.descricao || "—"}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}
                    {r.score_ia != null && ` · IA ${(Number(r.score_ia) * 100).toFixed(0)}%`}
                  </p>
                </TableCell>
                <TableCell>
                  {r.gravidade ? (
                    <Badge
                      variant="outline"
                      style={{ borderColor: GRAVIDADE_COR[r.gravidade], color: GRAVIDADE_COR[r.gravidade] }}
                    >
                      {r.gravidade}
                    </Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={r.status === "em_analise" ? "default" : "secondary"}>
                    {STATUS_LABEL[r.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString("pt-BR")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {r.status === "em_analise" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => updateStatus.mutate({ id: r.id, status: "validado" })}
                        title="Validar"
                      >
                        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      </Button>
                    )}
                    {(r.status === "validado" || r.status === "em_analise") && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => updateStatus.mutate({ id: r.id, status: "resolvido" })}
                        title="Marcar resolvido"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                      </Button>
                    )}
                    {r.status !== "descartado" && r.status !== "resolvido" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => updateStatus.mutate({ id: r.id, status: "descartado" })}
                        title="Descartar"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {r.status === "descartado" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy}
                        onClick={() => updateStatus.mutate({ id: r.id, status: "em_analise" })}
                        title="Reabrir"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
