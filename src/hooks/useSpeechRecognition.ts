import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as Window & {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useSpeechRecognition(lang = "pt-BR") {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef<(text: string) => void>(() => {});

  useEffect(() => {
    const Ctor = getSpeechRecognition();
    setSupported(!!Ctor);
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      const last = event.results[event.results.length - 1];
      if (!last?.isFinal) return;
      const text = last[0]?.transcript?.trim() ?? "";
      if (text) {
        setTranscript(text);
        onResultRef.current(text);
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current?._shouldRestart) {
        try {
          recognition.start();
        } catch {
          setListening(false);
        }
      } else {
        setListening(false);
      }
    };

    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition as SpeechRecognition & { _shouldRestart?: boolean };

    return () => {
      recognitionRef.current = null;
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
    };
  }, [lang]);

  const start = useCallback((onResult: (text: string) => void) => {
    const recognition = recognitionRef.current as (SpeechRecognition & { _shouldRestart?: boolean }) | null;
    if (!recognition) return false;
    onResultRef.current = onResult;
    recognition._shouldRestart = true;
    try {
      recognition.start();
      setListening(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current as (SpeechRecognition & { _shouldRestart?: boolean }) | null;
    if (!recognition) return;
    recognition._shouldRestart = false;
    try {
      recognition.stop();
    } catch {
      /* noop */
    }
    setListening(false);
  }, []);

  return { supported, listening, transcript, start, stop };
}
