import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

export type MicStatus = "unsupported" | "idle" | "listening" | "error" | "denied";

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
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
    if (!recognition || !shouldListenRef.current) return;
    try {
      recognition.start();
      setStatus("listening");
    } catch {
      /* já em execução */
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

    recognition.onend = () => {
      if (shouldListenRef.current) {
        window.setTimeout(startRecognition, 250);
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

  const requestMic = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      setStatus("denied");
      return false;
    }
  }, []);

  const start = useCallback(
    async (onResult: (text: string) => void) => {
      if (!recognitionRef.current) return false;
      const permitted = await requestMic();
      if (!permitted) return false;
      onResultRef.current = onResult;
      shouldListenRef.current = true;
      startRecognition();
      return true;
    },
    [requestMic, startRecognition],
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
    start,
    stop,
  };
}
