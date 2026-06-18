export const MAX_BUFFER_MS = 30 * 60 * 1000;
export const TRIM_BLOCK_MS = 5 * 60 * 1000;
export const CHUNK_MS = 5 * 60 * 1000;

export type VideoChunkMeta = {
  id: string;
  startedAt: number;
  durationMs: number;
  mimeType: string;
};

export function totalDuration(chunks: Pick<VideoChunkMeta, "durationMs">[]): number {
  return chunks.reduce((sum, c) => sum + c.durationMs, 0);
}

/** Retorna IDs dos blocos mais antigos a remover quando o buffer excede o limite. */
export function getChunksToTrim(
  chunks: VideoChunkMeta[],
  maxMs = MAX_BUFFER_MS,
  blockMs = TRIM_BLOCK_MS,
): string[] {
  const sorted = [...chunks].sort((a, b) => a.startedAt - b.startedAt);
  let total = totalDuration(sorted);
  const toRemove: string[] = [];

  while (total > maxMs && sorted.length > 0) {
    const removeTarget = Math.min(blockMs, total - maxMs);
    let removed = 0;
    while (sorted.length > 0 && removed < removeTarget) {
      const chunk = sorted.shift()!;
      removed += chunk.durationMs;
      toRemove.push(chunk.id);
      total -= chunk.durationMs;
    }
  }

  return toRemove;
}
