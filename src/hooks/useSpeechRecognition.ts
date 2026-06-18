import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

export type MicStatus = "unsupported" | "idle" | "listening" | "error" | "denied" | "prompt" | "capturing";

const SILENCE_MS = 5000;

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
  const [reportTranscript, setReportTranscript] = useState("");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const onResultRef = useRef<(text: string) => void>(() => {});
  const onReportCompleteRef = useRef<(text: string) => void>(() => {});
  const shouldListenRef = useRef(false);
  const reportModeRef = useRef(false);
  const finalPartsRef = useRef<string[]>([]);
  const silenceTimerRef = useRef<number | null>(null);

  const clearSilenceTimer = useCallback(() => {
    if (silenceTimerRef.current != null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }, []);

  const finishReportCapture = useCallback(() => {
    if (!reportModeRef.current) return;
    reportModeRef.current = false;
    shouldListenRef.current = false;
    clearSilenceTimer();

    const text = finalPartsRef.current.join(" ").trim();
    finalPartsRef.current = [];
    setReportTranscript("");

    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }

    setStatus("idle");
    if (text) onReportCompleteRef.current(text);
  }, [clearSilenceTimer]);

  const resetSilenceTimer = useCallback(() => {
    if (!reportModeRef.current) return;
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => finishReportCapture(), SILENCE_MS);
  }, [clearSilenceTimer, finishReportCapture]);

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || !shouldListenRef.current) return false;
    try {
      recognition.start();
      setStatus(reportModeRef.current ? "capturing" : "listening");
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
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const text = result[0]?.transcript?.trim() ?? "";
        if (!text) continue;

        if (reportModeRef.current) {
          if (result.isFinal) {
            finalPartsRef.current.push(text);
            resetSilenceTimer();
          } else {
            interim = text;
          }
        } else if (result.isFinal) {
          setTranscript(text);
          onResultRef.current(text);
        }
      }

      if (reportModeRef.current) {
        const full = [...finalPartsRef.current, interim].filter(Boolean).join(" ");
        setReportTranscript(full);
        if (interim) resetSilenceTimer();
      }
    };

    recognition.onstart = () =>
      setStatus(reportModeRef.current ? "capturing" : "listening");

    recognition.onend = () => {
      if (shouldListenRef.current && !reportModeRef.current) {
        window.setTimeout(() => startRecognition(), 300);
      } else if (!reportModeRef.current) {
        setStatus("idle");
      }
    };

    recognition.onerror = (event) => {
      const err = (event as SpeechRecognitionErrorEvent).error;
      if (err === "not-allowed" || err === "service-not-allowed") {
        shouldListenRef.current = false;
        reportModeRef.current = false;
        clearSilenceTimer();
        setStatus("denied");
        return;
      }
      if (err === "no-speech") {
        if (reportModeRef.current) resetSilenceTimer();
        return;
      }
      if (err === "aborted") return;
      setStatus("error");
    };

    recognitionRef.current = recognition;

    void queryMicPermission().then((state) => {
      if (state === "granted") setStatus("idle");
      if (state === "denied") setStatus("denied");
    });

    return () => {
      shouldListenRef.current = false;
      reportModeRef.current = false;
      clearSilenceTimer();
      try {
        recognition.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    };
  }, [lang, startRecognition, resetSilenceTimer, clearSilenceTimer]);

  const enableFromGesture = useCallback(
    (onResult: (text: string) => void) => {
      if (!recognitionRef.current) return false;

      reportModeRef.current = false;
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

  const startReportCapture = useCallback(
    (onComplete: (text: string) => void) => {
      if (!recognitionRef.current) return false;

      finalPartsRef.current = [];
      setReportTranscript("");
      reportModeRef.current = true;
      onReportCompleteRef.current = onComplete;
      shouldListenRef.current = true;
      setStatus("prompt");

      const started = startRecognition();
      if (started) resetSilenceTimer();

      if (navigator.mediaDevices?.getUserMedia) {
        navigator.mediaDevices
          .getUserMedia({ audio: true })
          .then((stream) => stream.getTracks().forEach((t) => t.stop()))
          .catch(() => {
            if (!started) setStatus("denied");
          });
      }

      if (!started) {
        reportModeRef.current = false;
        setStatus("error");
        return false;
      }
      return true;
    },
    [startRecognition, resetSilenceTimer],
  );

  const stop = useCallback(() => {
    if (reportModeRef.current) {
      finishReportCapture();
      return;
    }
    shouldListenRef.current = false;
    clearSilenceTimer();
    try {
      recognitionRef.current?.stop();
    } catch {
      /* noop */
    }
    setStatus("idle");
  }, [finishReportCapture, clearSilenceTimer]);

  return {
    supported,
    listening: status === "listening" || status === "capturing",
    capturing: status === "capturing",
    status,
    transcript,
    reportTranscript,
    enableFromGesture,
    startReportCapture,
    stop,
  };
}
