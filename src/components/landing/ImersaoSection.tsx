import { useState } from "react";
import { Flame, Lock, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ImersaoPlayer } from "@/components/landing/ImersaoPlayer";
import { IMERSAO_JORNADAS, type ImersaoJornada } from "@/lib/imersao-jornadas";

const EM_BREVE: Pick<ImersaoJornada, "avatarNome" | "jornadaTitulo" | "descricao" | "cor">[] = [
  {
    avatarNome: "Caminhoneiro",
    jornadaTitulo: "Carga contra o tempo",
    descricao: "Mil quilômetros, prazo apertado e uma estrada que não perdoa. Em breve.",
    cor: "#F59E0B",
  },
  {
    avatarNome: "Guardião",
    jornadaTitulo: "Olhos na pista",
    descricao: "Você avista um risco que ninguém mais viu. O que faz nos próximos segundos? Em breve.",
    cor: "#003A70",
  },
];

export function ImersaoSection() {
  const [jornadaAtiva, setJornadaAtiva] = useState<ImersaoJornada | null>(null);
  const [sessionKey, setSessionKey] = useState(0);

  function abrirJornada(j: ImersaoJornada) {
    setJornadaAtiva(j);
    setSessionKey((k) => k + 1);
  }

  function fechar() {
    setJornadaAtiva(null);
  }

  return (
    <section id="imersao" className="border-y border-border/60 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
            <Sparkles className="h-3.5 w-3.5" /> Imersão
          </span>
          <h2 className="mt-2 font-display text-3xl font-bold sm:text-4xl">
            Viva a estrada por outro olhar
          </h2>
          <p className="mt-4 text-muted-foreground">
            Escolha um avatar e encare uma jornada real. Sinta na pele as decisões que separam a vida da morte nas rodovias brasileiras.
          </p>
        </div>

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {IMERSAO_JORNADAS.map((j) => {
            const Icon = j.icone;
            return (
              <AvatarCard
                key={j.id}
                avatarNome={j.avatarNome}
                jornadaTitulo={j.jornadaTitulo}
                descricao={j.descricao}
                cor={j.cor}
                icone={Icon}
                onSelect={() => abrirJornada(j)}
              />
            );
          })}
          {EM_BREVE.map((j) => (
            <AvatarCard
              key={j.avatarNome}
              avatarNome={j.avatarNome}
              jornadaTitulo={j.jornadaTitulo}
              descricao={j.descricao}
              cor={j.cor}
              bloqueado
            />
          ))}
        </div>
      </div>

      <Dialog open={!!jornadaAtiva} onOpenChange={(open) => !open && fechar()}>
        <DialogContent className="fixed inset-0 z-50 flex h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden border-0 bg-background p-0 shadow-none sm:rounded-none [&>button.absolute]:hidden">
          {jornadaAtiva && (
            <ImersaoPlayer key={`${jornadaAtiva.id}-${sessionKey}`} jornada={jornadaAtiva} onClose={fechar} />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function AvatarCard({
  avatarNome,
  jornadaTitulo,
  descricao,
  cor,
  icone: IconProp,
  onSelect,
  bloqueado = false,
}: {
  avatarNome: string;
  jornadaTitulo: string;
  descricao: string;
  cor: string;
  icone?: typeof Flame;
  onSelect?: () => void;
  bloqueado?: boolean;
}) {
  const Icon = bloqueado ? Lock : (IconProp ?? Flame);

  return (
    <article
      className={`flex flex-col rounded-2xl border bg-card p-6 transition ${
        bloqueado ? "opacity-60" : "hover:border-primary/40 hover:shadow-lg"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div
          className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
          style={{ backgroundColor: `color-mix(in oklab, ${cor} 18%, transparent)` }}
        >
          <Icon className="h-7 w-7" style={{ color: cor }} />
        </div>
        {!bloqueado && (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
            Disponível
          </span>
        )}
        {bloqueado && (
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Em breve
          </span>
        )}
      </div>

      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {jornadaTitulo}
      </p>
      <h3 className="mt-1 font-display text-xl font-bold">{avatarNome}</h3>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{descricao}</p>

      {!bloqueado && onSelect && (
        <Button className="mt-6 w-full gap-2" onClick={onSelect}>
          <Play className="h-4 w-4" /> Vivenciar jornada
        </Button>
      )}
    </article>
  );
}
