import { useCallback, useRef, useState } from "react";
import { Building2, Map, Play, Route, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImersaoJornada } from "@/lib/imersao-jornadas";
import {
  CORRIDA_PELA_VIDA_INTRO,
  CORRIDA_PELA_VIDA_RAMOS,
  type ImersaoCardStep,
  type ImersaoChoiceStep,
  type ImersaoStep,
  type ImersaoVideoStep,
} from "@/lib/imersao-corrida-pela-vida";

type Fase = "briefing" | "steps";

type Props = {
  jornada: ImersaoJornada;
  onClose: () => void;
};

function getStepsForJornada(jornadaId: string): ImersaoStep[] {
  if (jornadaId === "corrida-pela-vida") return CORRIDA_PELA_VIDA_INTRO;
  return jornada.videos.map((v) => ({
    type: "video" as const,
    id: v.id,
    src: v.src,
    titulo: v.titulo ?? "Cena",
    autoPlay: true,
  }));
}

export function ImersaoPlayer({ jornada, onClose }: Props) {
  const [fase, setFase] = useState<Fase>("briefing");
  const [steps, setSteps] = useState<ImersaoStep[]>(() => getStepsForJornada(jornada.id));
  const [stepIndex, setStepIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const step = steps[stepIndex];
  const BriefingIcon = jornada.icone;
  const isLastStep = stepIndex >= steps.length - 1;

  const avancar = useCallback(() => {
    if (stepIndex < steps.length - 1) {
      setStepIndex((i) => i + 1);
      return;
    }
    onClose();
  }, [onClose, stepIndex, steps.length]);

  const escolherRota = useCallback(
    (opcaoId: string) => {
      const ramo = CORRIDA_PELA_VIDA_RAMOS[opcaoId];
      if (!ramo) return;
      setSteps(ramo);
      setStepIndex(0);
    },
    [],
  );

  const onVideoEnded = useCallback(() => {
    avancar();
  }, [avancar]);

  function iniciarJornada() {
    setFase("steps");
    setSteps(getStepsForJornada(jornada.id));
    setStepIndex(0);
  }

  if (fase === "briefing") {
    return (
      <div className="p-6 sm:p-8">
        <DialogHeader className="text-left">
          <div className="mb-4 flex items-center gap-3">
            <div
              className="grid h-14 w-14 place-items-center rounded-2xl"
              style={{ backgroundColor: `color-mix(in oklab, ${jornada.cor} 18%, transparent)` }}
            >
              {BriefingIcon && <BriefingIcon className="h-7 w-7" style={{ color: jornada.cor }} />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {jornada.jornadaTitulo}
              </p>
              <DialogTitle className="font-display text-2xl">Você é um {jornada.avatarNome}</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-base leading-relaxed text-foreground/90">
            {jornada.briefing}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-8 flex flex-wrap gap-3">
          <Button size="lg" className="gap-2" onClick={iniciarJornada}>
            <Play className="h-4 w-4" /> Iniciar jornada
          </Button>
          <Button size="lg" variant="outline" onClick={onClose}>
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  if (!step) return null;

  return (
    <div className="relative bg-background">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
        aria-label="Fechar"
      >
        <X className="h-4 w-4" />
      </button>

      {step.type === "video" && <VideoStep step={step} videoRef={videoRef} onEnded={onVideoEnded} jornada={jornada} />}
      {step.type === "card" && (
        <CardStep
          step={step}
          jornada={jornada}
          onContinue={avancar}
          isFinal={isLastStep && step.id.startsWith("fim")}
        />
      )}
      {step.type === "choice" && <ChoiceStep step={step} jornada={jornada} onChoose={escolherRota} />}
    </div>
  );
}

function VideoStep({
  step,
  videoRef,
  onEnded,
  jornada,
}: {
  step: ImersaoVideoStep;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  onEnded: () => void;
  jornada: ImersaoJornada;
}) {
  return (
    <div className="bg-black">
      <div className="border-b border-white/10 px-4 py-3 text-white">
        <p className="text-xs uppercase tracking-wider text-white/60">{jornada.jornadaTitulo}</p>
        <p className="font-display font-semibold">{step.titulo}</p>
      </div>
      <video
        ref={videoRef}
        key={step.src}
        className="aspect-video w-full bg-black"
        src={step.src}
        controls
        autoPlay={step.autoPlay !== false}
        playsInline
        preload="auto"
        onEnded={onEnded}
      >
        Seu navegador não suporta reprodução de vídeo.
      </video>
    </div>
  );
}

function CardStep({
  step,
  jornada,
  onContinue,
  isFinal,
}: {
  step: ImersaoCardStep;
  jornada: ImersaoJornada;
  onContinue: () => void;
  isFinal?: boolean;
}) {
  return (
    <div className="p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{jornada.jornadaTitulo}</p>
      <h3 className="mt-2 font-display text-2xl font-bold">{step.titulo}</h3>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{step.texto}</p>
      <Button size="lg" className="mt-8 gap-2" onClick={onContinue}>
        {step.continuarLabel ?? (isFinal ? "Encerrar jornada" : "Continuar")}
      </Button>
    </div>
  );
}

function ChoiceStep({
  step,
  jornada,
  onChoose,
}: {
  step: ImersaoChoiceStep;
  jornada: ImersaoJornada;
  onChoose: (id: string) => void;
}) {
  return (
    <div className="p-6 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{jornada.jornadaTitulo}</p>
      <h3 className="mt-2 font-display text-2xl font-bold">{step.titulo}</h3>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{step.texto}</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {step.opcoes.map((op) => {
          const Icon = op.id === "concessionada" ? Building2 : Route;
          return (
            <button
              key={op.id}
              type="button"
              onClick={() => onChoose(op.id)}
              className="rounded-2xl border bg-card p-5 text-left transition hover:border-primary/50 hover:bg-surface"
            >
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-display font-bold">{op.label}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{op.descricao}</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Map className="h-3.5 w-3.5" /> Sua escolha altera o restante da jornada.
      </p>
    </div>
  );
}
