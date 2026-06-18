import { useCallback, useEffect, useRef, useState } from "react";

const MAX_BUFFER_MS = 30 * 60 * 1000;
const TRIM_MS = 5 * 60 * 1000;
const CHUNK_MS = 60 * 1000;

type VideoChunk = {
  id: string;
  blob: Blob;
  startedAt: number;
  durationMs: number;
};

function totalDuration(chunks: VideoChunk[]): number {
  return chunks.reduce((sum, c) => sum + c.durationMs, 0);
}

function trimChunks(chunks: VideoChunk[]): VideoChunk[] {
  let next = [...chunks];
  let total = totalDuration(next);

  while (total > MAX_BUFFER_MS && next.length > 0) {
    const removeTarget = Math.min(TRIM_MS, total - MAX_BUFFER_MS);
    let removed = 0;
    while (next.length > 0 && removed < removeTarget) {
      const first = next[0];
      removed += first.durationMs;
      next.shift();
    }
    total = totalDuration(next);
  }

  return next;
}

export function useSecurityCamera(enabled: boolean) {
  const [active, setActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const chunksRef = useRef<VideoChunk[]>([]);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunkStartRef = useRef(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const refreshStats = useCallback(() => {
    const mins = totalDuration(chunksRef.current) / 60_000;
    setBufferMinutes(Math.round(mins * 10) / 10);
  }, []);

  const stopCamera = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
  }, []);

  const startChunk = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")
      ? "video/webm;codecs=vp8,opus"
      : "video/webm";

    const recorder = new MediaRecorder(stream, { mimeType: mime });
    const parts: Blob[] = [];
    chunkStartRef.current = Date.now();

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) parts.push(e.data);
    };

    recorder.onstop = () => {
      if (parts.length === 0) return;
      const blob = new Blob(parts, { type: mime });
      const durationMs = Math.max(CHUNK_MS, Date.now() - chunkStartRef.current);
      chunksRef.current = trimChunks([
        ...chunksRef.current,
        { id: crypto.randomUUID(), blob, startedAt: chunkStartRef.current, durationMs },
      ]);
      refreshStats();
      if (streamRef.current && enabled) startChunk();
    };

    recorder.start();
    recorderRef.current = recorder;
    window.setTimeout(() => {
      if (recorderRef.current === recorder && recorder.state === "recording") {
        recorder.stop();
      }
    }, CHUNK_MS);
  }, [enabled, refreshStats]);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Câmera indisponível neste dispositivo");
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: true,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }

      setActive(true);
      setError(null);
      startChunk();
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Permissão de câmera negada");
      return false;
    }
  }, [startChunk]);

  const toggle = useCallback(async () => {
    if (active) {
      stopCamera();
      return false;
    }
    return startCamera();
  }, [active, startCamera, stopCamera]);

  useEffect(() => {
    if (!enabled && active) stopCamera();
  }, [enabled, active, stopCamera]);

  useEffect(() => () => stopCamera(), [stopCamera]);

  return {
    videoRef,
    active,
    error,
    bufferMinutes,
    toggle,
    stopCamera,
    chunks: chunksRef.current,
  };
}
