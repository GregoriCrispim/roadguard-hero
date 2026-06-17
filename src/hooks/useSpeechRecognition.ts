import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

export type MicStatus = "unsupported" | "idle" | "listening" | "error" | "denied" | "prompt";

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

async function queryMicPermission(): Promise<PermissionState | "unknown"> {
  if (!navigator.permissions?.query) return "unknown";
  try {
    const result = await navigator.permissions.query({ name: "microphone" as PermissionName });
    return result.state;
  } catch {
    return "unknown";
  }
}

export function useSpeechRecognition(lang = "pt-BR") {
  const [status, setStatus] = useState<MicStatus>("idle");
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef<(text: string) => void>(() => {});
  const shouldListenRef = useRef(false);

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !shouldListenRef.current) return false;
    try {
      recognition.start();
      setStatus("listening");
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const Ctor = getSpeechRecognition();
    setSupported(!!Ctor);
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (!result?.isFinal) continue;
        const text = result[0]?.transcript?.trim() ?? "";
        if (text) {
          setTranscript(text);
          onResultRef.current(text);
        }
      }
    };

    recognition.onstart = () => setStatus("listening");

    recognition.onend = () => {
      if (shouldListenRef.current) {
        window.setTimeout(() => startRecognition(), 300);
      } else {
        setStatus("idle");
      }
    };

    recognition.onerror = (event) => {
      const err = (event as SpeechRecognitionErrorEvent).error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        shouldListenRef.current = false;
        setStatus("denied");
        return;
      }
      if (err === "no-speech" || err === "aborted") return;
      setStatus("error");
    };

    recognitionRef.current = recognition;

    void queryMicPermission().then((state) => {
      if (state === "granted") setStatus("idle");
      if (state === "denied") setStatus("denied");
    });

    return () => {
      shouldListenRef.current = false;
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    };
  }, [lang, startRecognition]);

  /**
   * Deve ser chamado diretamente de um clique/toque do usuário.
   * Inicia o reconhecimento na mesma cadeia do gesto para o navegador exibir o prompt.
   */
  const enableFromGesture = useCallback(
    (onResult: (text: string) => void) => {
      if (!recognitionRef.current) return false;

      onResultRef.current = onResult;
      shouldListenRef.current = true;
      setStatus("prompt");

      const started = startRecognition();

      if (navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => stream.getTracks().forEach((t) => t.stop()))
          .catch(() => {
            if (!started) setStatus("denied");
          });
      }

      if (!started) {
        setStatus("error");
        return false;
      }
      return true;
    },
    [startRecognition],
  );

  const start = useCallback(
    async (onResult: (text: string) => void) => {
      if (!recognitionRef.current) return false;

      const perm = await queryMicPermission();
      if (perm === "denied") {
        setStatus("denied");
        return false;
      }

      if (navigator.mediaDevices?.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((t) => t.stop());
        } catch {
          setStatus("denied");
          return false;
        }
      }

      onResultRef.current = onResult;
      shouldListenRef.current = true;
      return startRecognition();
    },
    [startRecognition],
  );

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setStatus("idle");
  }, []);

  return {
    supported,
    listening: status === "listening",
    status,
    transcript,
    enableFromGesture,
    start,
    stop,
  };
}
