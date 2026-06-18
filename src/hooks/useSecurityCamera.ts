import { useCallback, useEffect, useRef, useState } from "react";
import { CHUNK_MS } from "@/lib/video-buffer-trim";
import { getBufferStats, saveVideoChunk } from "@/lib/video-buffer-storage";

const TIMESLICE_MS = 1000;

function getRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
    "video/mp4;codecs=avc1",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? null;
}

async function openCameraStream(): Promise<MediaStream> {
  const videoConstraints: MediaTrackConstraints[] = [
    { facingMode: { exact: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    { width: { ideal: 1280 }, height: { ideal: 720 } },
  ];

  let lastError: unknown;
  for (const video of videoConstraints) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: true });
    } catch (e) {
      lastError = e;
      try {
        return await navigator.mediaDevices.getUserMedia({ video, audio: false });
      } catch (e2) {
        lastError = e2;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Não foi possível acessar a câmera");
}

export function useSecurityCamera(enabled: boolean) {
  const [active, setActive] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [supported] = useState(() =>
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof indexedDB !== "undefined" &&
    getRecorderMimeType() != null,
  );

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkStartRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const recordingRef = useRef(false);
  const mimeRef = useRef<string>("video/webm");

  const refreshStats = useCallback(async () => {
    try {
      const stats = await getBufferStats();
      setBufferMinutes(stats.minutes);
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const attachStreamToVideo = useCallback((stream: MediaStream) => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    el.muted = true;
    void el.play().catch(() => undefined);
  }, []);

  const setVideoRef = useCallback(
    (node: HTMLVideoElement | null) => {
      videoRef.current = node;
      if (node && streamRef.current) attachStreamToVideo(streamRef.current);
    },
    [attachStreamToVideo],
  );

  const stopCamera = useCallback(() => {
    recordingRef.current = false;

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      try {
        recorderRef.current.stop();
      } catch {
        /* noop */
      }
    }
    recorderRef.current = null;

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setRequesting(false);
  }, []);

  const startChunk = useCallback(() => {
    const stream = streamRef.current;
    if (!stream || !recordingRef.current) return;

    const mime = mimeRef.current;
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      setError("Gravação não suportada neste navegador");
      stopCamera();
      return;
    }

    const parts: Blob[] = [];
    chunkStartRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) parts.push(e.data);
    };

    recorder.onerror = () => {
      setError("Erro durante a gravação");
      stopCamera();
    };

    recorder.onstop = () => {
      void (async () => {
        if (parts.length > 0) {
          const blob = new Blob(parts, { type: mime });
          const durationMs = Math.max(TIMESLICE_MS, Date.now() - chunkStartRef.current);
          try {
            await saveVideoChunk({
              id: crypto.randomUUID(),
              blob,
              startedAt: chunkStartRef.current,
              durationMs,
              mimeType: mime,
            });
            await refreshStats();
          } catch {
            setError("Não foi possível salvar o vídeo no dispositivo");
          }
        }

        if (recordingRef.current && streamRef.current) {
          startChunk();
        }
      })();
    };

    try {
      recorder.start(TIMESLICE_MS);
      recorderRef.current = recorder;
    } catch {
      setError("Não foi possível iniciar a gravação");
      stopCamera();
      return;
    }

    window.setTimeout(() => {
      if (recorderRef.current === recorder && recorder.state === "recording") {
        recorder.stop();
      }
    }, CHUNK_MS);
  }, [refreshStats, stopCamera]);

  const startCamera = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
    if (!supported) {
      const msg = "Câmera, gravação ou armazenamento local não suportados neste dispositivo.";
      setError(msg);
      return { ok: false, error: msg };
    }

    const mime = getRecorderMimeType();
    if (!mime) {
      const msg = "Formato de vídeo não suportado neste navegador";
      setError(msg);
      return { ok: false, error: msg };
    }
    mimeRef.current = mime;

    setRequesting(true);
    setError(null);

    try {
      const stream = await openCameraStream();
      streamRef.current = stream;
      attachStreamToVideo(stream);

      recordingRef.current = true;
      setActive(true);
      startChunk();
      return { ok: true };
    } catch (e: unknown) {
      const msg =
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "Permissão de câmera negada. Permita o acesso nas configurações do navegador."
          : e instanceof Error
            ? e.message
            : "Não foi possível acessar a câmera";
      setError(msg);
      stopCamera();
      return { ok: false, error: msg };
    } finally {
      setRequesting(false);
    }
  }, [supported, attachStreamToVideo, startChunk, stopCamera]);

  const toggle = useCallback(async (): Promise<{ started: boolean; error?: string }> => {
    if (active || requesting) {
      stopCamera();
      return { started: false };
    }
    const res = await startCamera();
    return { started: res.ok, error: res.error };
  }, [active, requesting, startCamera, stopCamera]);

  useEffect(() => {
    if (!enabled && (active || requesting)) stopCamera();
  }, [enabled, active, requesting, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return {
    setVideoRef,
    supported,
    active,
    requesting,
    error,
    bufferMinutes,
    toggle,
    stopCamera,
    refreshStats,
  };
}
