/** Größe eines einzelnen Parts — der letzte Part ist meist kleiner als `partSize`. */
export function partByteSize(
  partNumber: number,
  totalParts: number,
  partSize: number,
  totalBytes: number,
): number {
  if (partNumber < totalParts) {
    return partSize;
  }
  const remainder = totalBytes - partSize * (totalParts - 1);
  return remainder > 0 ? remainder : partSize;
}

export interface SpeedSample {
  readonly atMs: number;
  readonly loadedBytes: number;
}

/** Gleitender Durchsatz über die letzten `windowMs`, statt eines verzerrenden Gesamt-Durchschnitts. */
export function bytesPerSecond(samples: readonly SpeedSample[], windowMs = 5000): number {
  if (samples.length < 2) {
    return 0;
  }
  const latest = samples[samples.length - 1];
  const cutoff = latest.atMs - windowMs;
  const base = samples.find((sample) => sample.atMs >= cutoff) ?? samples[0];
  const elapsedSeconds = (latest.atMs - base.atMs) / 1000;
  if (elapsedSeconds <= 0) {
    return 0;
  }
  return Math.max(0, (latest.loadedBytes - base.loadedBytes) / elapsedSeconds);
}

export function etaSeconds(remainingBytes: number, speedBytesPerSecond: number): number | null {
  if (speedBytesPerSecond <= 0) {
    return null;
  }
  return remainingBytes / speedBytesPerSecond;
}
