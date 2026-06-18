import { useState } from "react";
import { Flame, Lock, Play, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IMERSAO_JORNADAS, type ImersaoJornada } from "@/lib/imersao-jornadas";

type Fase = "avatars" | "briefing" | "video";

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
  const [fase, setFase] = useState<Fase>("avatars");
  const [jornadaAtiva, setJornadaAtiva] = useState<ImersaoJornada | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  function abrirJornada(jornada: ImersaoJornada) {
    setJornadaAtiva(jornada);
    setFase("briefing");
    setDialogOpen(true);
  }

  function fechar() {
    setDialogOpen(false);
    setFase("avatars");
    setJornadaAtiva(null);
  }

  function iniciarVideo() {
    setFase("video");
  }

  const video = jornadaAtiva?.videos[0];
  const BriefingIcon = jornadaAtiva?.icone;

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

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) fechar();
        }}
      >
        <DialogContent className="max-w-3xl gap-0 overflow-hidden p-0 sm:rounded-2xl">
          {jornadaAtiva && fase === "briefing" && (
            <div className="p-6 sm:p-8">
              <DialogHeader className="text-left">
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className="grid h-14 w-14 place-items-center rounded-2xl"
                    style={{ backgroundColor: `color-mix(in oklab, ${jornadaAtiva.cor} 18%, transparent)` }}
                  >
                    {BriefingIcon && <BriefingIcon className="h-7 w-7" style={{ color: jornadaAtiva.cor }} />}
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      {jornadaAtiva.jornadaTitulo}
                    </p>
                    <DialogTitle className="font-display text-2xl">
                      Você é um {jornadaAtiva.avatarNome}
                    </DialogTitle>
                  </div>
                </div>
                <DialogDescription className="text-base leading-relaxed text-foreground/90">
                  {jornadaAtiva.briefing}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="gap-2" onClick={iniciarVideo}>
                  <Play className="h-4 w-4" /> Iniciar jornada
                </Button>
                <Button size="lg" variant="outline" onClick={fechar}>
                  Voltar
                </Button>
              </div>
            </div>
          )}

          {jornadaAtiva && fase === "video" && video && (
            <div className="relative bg-black">
              <button
                type="button"
                onClick={fechar}
                className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="border-b border-white/10 px-4 py-3 text-white">
                <p className="text-xs uppercase tracking-wider text-white/60">{jornadaAtiva.jornadaTitulo}</p>
                <p className="font-display font-semibold">{video.titulo ?? "Cena 1"}</p>
              </div>
              <video
                key={video.src}
                className="aspect-video w-full bg-black"
                src={video.src}
                controls
                autoPlay
                playsInline
                preload="auto"
              >
                Seu navegador não suporta reprodução de vídeo.
              </video>
            </div>
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
