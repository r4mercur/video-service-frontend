import { bytesPerSecond, etaSeconds, partByteSize } from './upload-progress-math';

describe('partByteSize', () => {
  it('returns the full part size for every part before the last one', () => {
    expect(partByteSize(1, 3, 1000, 2500)).toBe(1000);
    expect(partByteSize(2, 3, 1000, 2500)).toBe(1000);
  });

  it('returns the remainder for the last part', () => {
    expect(partByteSize(3, 3, 1000, 2500)).toBe(500);
  });

  it('falls back to the full part size when the file size divides evenly', () => {
    expect(partByteSize(2, 2, 1000, 2000)).toBe(1000);
  });
});

describe('bytesPerSecond', () => {
  it('returns 0 with fewer than two samples', () => {
    expect(bytesPerSecond([])).toBe(0);
    expect(bytesPerSecond([{ atMs: 0, loadedBytes: 0 }])).toBe(0);
  });

  it('computes throughput between the oldest sample in the window and the latest', () => {
    const samples = [
      { atMs: 0, loadedBytes: 0 },
      { atMs: 1000, loadedBytes: 1_000_000 },
      { atMs: 2000, loadedBytes: 2_000_000 },
    ];
    expect(bytesPerSecond(samples, 5000)).toBe(1_000_000);
  });

  it('ignores samples outside the trailing window', () => {
    const samples = [
      { atMs: 0, loadedBytes: 0 },
      { atMs: 10_000, loadedBytes: 5_000_000 },
      { atMs: 11_000, loadedBytes: 6_000_000 },
    ];
    // Only the last 5s count: from 10_000 (5_000_000) to 11_000 (6_000_000) => 1_000_000 B/s.
    expect(bytesPerSecond(samples, 5000)).toBe(1_000_000);
  });

  it('never returns a negative rate', () => {
    const samples = [
      { atMs: 0, loadedBytes: 1000 },
      { atMs: 1000, loadedBytes: 1000 },
    ];
    expect(bytesPerSecond(samples)).toBe(0);
  });
});

describe('etaSeconds', () => {
  it('returns null when there is no measured speed yet', () => {
    expect(etaSeconds(1000, 0)).toBeNull();
  });

  it('divides remaining bytes by the current speed', () => {
    expect(etaSeconds(2000, 500)).toBe(4);
  });
});
