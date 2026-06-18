/** Junta segmentos finais do Web Speech API sem repetir trechos sobrepostos. */
export function mergeTranscriptParts(parts: string[]): string {
  if (!parts.length) return "";
  let result = parts[0].trim();
  for (let i = 1; i < parts.length; i++) {
    const next = parts[i].trim();
    if (!next) continue;
    if (next.startsWith(result)) {
      result = next;
      continue;
    }
    if (result.endsWith(next) || result.includes(next)) continue;
    if (next.includes(result)) {
      result = next;
      continue;
    }
    result = `${result} ${next}`;
  }
  return result.trim();
}

/** Monta texto ao vivo (finais + interim) sem duplicar o que já foi confirmado. */
export function buildLiveTranscript(finals: string[], interim: string): string {
  const committed = mergeTranscriptParts(finals);
  const live = interim.trim();
  if (!live) return committed;
  if (!committed) return live;
  if (live.startsWith(committed)) {
    const suffix = live.slice(committed.length).trim();
    return suffix ? `${committed} ${suffix}` : committed;
  }
  if (committed.includes(live)) return committed;
  if (live.includes(committed)) return live;
  return `${committed} ${live}`;
}
