import {
  getChunksToTrim,
  totalDuration,
  type VideoChunkMeta,
} from "@/lib/video-buffer-trim";

const DB_NAME = "roadhero-video-buffer";
const DB_VERSION = 1;
const STORE = "chunks";

export type StoredVideoChunk = VideoChunkMeta & { blob: Blob };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB indisponível"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir armazenamento"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("startedAt", "startedAt", { unique: false });
      }
    };
  });
}

function withStore<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const req = fn(tx.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Operação no armazenamento falhou"));
        tx.oncomplete = () => db.close();
        tx.onerror = () => reject(tx.error ?? new Error("Transação no armazenamento falhou"));
      }),
  );
}

export async function listChunkMetas(): Promise<VideoChunkMeta[]> {
  const rows = await withStore<StoredVideoChunk[]>("readonly", (store) => store.getAll());
  return rows
    .map(({ id, startedAt, durationMs, mimeType }) => ({ id, startedAt, durationMs, mimeType }))
    .sort((a, b) => a.startedAt - b.startedAt);
}

export async function saveVideoChunk(chunk: StoredVideoChunk): Promise<void> {
  await withStore("readwrite", (store) => store.put(chunk));
  const metas = await listChunkMetas();
  const toRemove = getChunksToTrim(metas);
  if (toRemove.length > 0) await deleteVideoChunks(toRemove);
}

export async function deleteVideoChunks(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const id of ids) store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Falha ao apagar blocos"));
  });
  db.close();
}

export async function getBufferStats(): Promise<{ minutes: number; chunks: number; bytes: number }> {
  const rows = await withStore<StoredVideoChunk[]>("readonly", (store) => store.getAll());
  const ms = totalDuration(rows);
  const bytes = rows.reduce((sum, c) => sum + c.blob.size, 0);
  return {
    minutes: Math.round((ms / 60_000) * 10) / 10,
    chunks: rows.length,
    bytes,
  };
}

export async function clearVideoBuffer(): Promise<void> {
  await withStore("readwrite", (store) => store.clear());
}

export async function exportRecentClip(durationMs: number): Promise<Blob | null> {
  const rows = await withStore<StoredVideoChunk[]>("readonly", (store) => store.getAll());
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => a.startedAt - b.startedAt);
  let collected: StoredVideoChunk[] = [];
  let total = 0;

  for (let i = sorted.length - 1; i >= 0; i--) {
    const chunk = sorted[i];
    collected.unshift(chunk);
    total += chunk.durationMs;
    if (total >= durationMs) break;
  }

  if (collected.length === 0) return null;
  return new Blob(
    collected.map((c) => c.blob),
    { type: collected[0].mimeType },
  );
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
