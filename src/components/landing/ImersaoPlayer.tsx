import { useCallback, useEffect, useRef, useState } from "react";
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

async function playVideo(el: HTMLVideoElement) {
  el.currentTime = 0;
  try {
    await el.play();
  } catch {
    el.muted = true;
    try {
      await el.play();
    } catch {
      /* usuário pode tocar nos controles */
    }
  }
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur hover:bg-black/70"
      aria-label="Fechar"
    >
      <X className="h-5 w-5" />
    </button>
  );
}

export function ImersaoPlayer({ jornada, onClose }: Props) {
  const [fase, setFase] = useState<Fase>("briefing");
  const [steps, setSteps] = useState<ImersaoStep[]>(() => getStepsForJornada(jornada.id));
  const [stepIndex, setStepIndex] = useState(0);

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

  const escolherRota = useCallback((opcaoId: string) => {
    const ramo = CORRIDA_PELA_VIDA_RAMOS[opcaoId];
    if (!ramo) return;
    setSteps(ramo);
    setStepIndex(0);
  }, []);

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
      <div className="relative flex h-full min-h-[100dvh] w-full flex-col justify-center px-6 py-12 sm:px-12">
        <CloseButton onClose={onClose} />
        <div className="mx-auto w-full max-w-2xl">
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
                <DialogTitle className="font-display text-2xl sm:text-3xl">
                  Você é um {jornada.avatarNome}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-base leading-relaxed text-foreground/90 sm:text-lg">
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
      </div>
    );
  }

  if (!step) return null;

  return (
    <div className="relative flex h-full min-h-[100dvh] w-full flex-col">
      <CloseButton onClose={onClose} />

      {step.type === "video" && (
        <VideoStep step={step} onEnded={onVideoEnded} jornada={jornada} />
      )}
      {step.type === "card" && (
        <CardStep
          step={step}
          jornada={jornada}
          onContinue={avancar}
          isFinal={isLastStep && step.id.startsWith("fim")}
        />
      )}
      {step.type === "choice" && (
        <ChoiceStep step={step} jornada={jornada} onChoose={escolherRota} />
      )}
    </div>
  );
}

function VideoStep({
  step,
  onEnded,
  jornada,
}: {
  step: ImersaoVideoStep;
  onEnded: () => void;
  jornada: ImersaoJornada;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || step.autoPlay === false) return;
    void playVideo(el);
  }, [step.src, step.autoPlay]);

  return (
    <div className="relative flex h-full min-h-[100dvh] w-full flex-col bg-black">
      <video
        ref={videoRef}
        key={step.src}
        className="h-full w-full flex-1 object-contain"
        src={step.src}
        controls
        autoPlay
        playsInline
        preload="auto"
        onEnded={onEnded}
      >
        Seu navegador não suporta reprodução de vídeo.
      </video>
      <div className="pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/80 via-black/40 to-transparent px-5 pb-10 pt-14 text-white">
        <p className="text-xs uppercase tracking-wider text-white/70">{jornada.jornadaTitulo}</p>
        <p className="font-display text-lg font-semibold sm:text-xl">{step.titulo}</p>
      </div>
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
  const [progress, setProgress] = useState(0);
  const autoMs = !isFinal ? step.autoAdvanceMs : undefined;
  const onContinueRef = useRef(onContinue);
  onContinueRef.current = onContinue;

  useEffect(() => {
    if (!autoMs) return;
    const start = Date.now();
    const tick = window.setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / autoMs) * 100);
      setProgress(pct);
    }, 50);
    const timer = window.setTimeout(() => onContinueRef.current(), autoMs);
    return () => {
      window.clearInterval(tick);
      window.clearTimeout(timer);
    };
  }, [autoMs, step.id]);

  function pular() {
    onContinueRef.current();
  }

  return (
    <div className="flex h-full min-h-[100dvh] w-full flex-col justify-center bg-gradient-to-b from-background via-background to-surface/80 px-6 py-16 sm:px-12 sm:py-20">
      <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{jornada.jornadaTitulo}</p>
        <h3 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{step.titulo}</h3>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">{step.texto}</p>

        {autoMs ? (
          <div className="mt-10 space-y-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-[width] duration-100 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground">A cena continua automaticamente…</p>
            <Button size="lg" variant="outline" onClick={pular}>
              Pular agora
            </Button>
          </div>
        ) : (
          <Button size="lg" className="mt-10 gap-2" onClick={onContinue}>
            {step.continuarLabel ?? (isFinal ? "Encerrar jornada" : "Continuar")}
          </Button>
        )}
      </div>
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
    <div className="flex h-full min-h-[100dvh] w-full flex-col justify-center bg-gradient-to-b from-background via-background to-surface/80 px-6 py-16 sm:px-12">
      <div className="mx-auto w-full max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{jornada.jornadaTitulo}</p>
        <h3 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{step.titulo}</h3>
        <p className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl">{step.texto}</p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {step.opcoes.map((op) => {
            const Icon = op.id === "concessionaria" ? Building2 : Route;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => onChoose(op.id)}
                className="rounded-2xl border bg-card p-6 text-left transition hover:border-primary/50 hover:bg-surface sm:p-8"
              >
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="font-display text-xl font-bold">{op.label}</p>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">{op.descricao}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
          <Map className="h-4 w-4" /> Sua escolha altera o restante da jornada.
        </p>
      </div>
    </div>
  );
}
