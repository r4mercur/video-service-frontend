import { PlaybackTelemetryBatch } from './playback-telemetry-batch';

describe('PlaybackTelemetryBatch', () => {
  it('reports nothing until there is an actual observation', () => {
    const batch = new PlaybackTelemetryBatch();

    expect(batch.drain()).toBeNull();

    // A rendition on its own is session state, not an observation - it must not trigger a POST.
    batch.setHeight(720);
    expect(batch.drain()).toBeNull();
  });

  it('collects fragments, stalls and errors into one body', () => {
    const batch = new PlaybackTelemetryBatch();
    batch.setHeight(360);
    batch.recordFragment(6000, 200_000);
    batch.recordFragment(4300, 180_000);
    batch.recordStall();
    batch.recordFragmentError();
    batch.recordFragmentError();

    expect(batch.drain()).toEqual({
      height: 360,
      fragments: [
        { loadMs: 6000, bytes: 200_000 },
        { loadMs: 4300, bytes: 180_000 },
      ],
      stalls: 1,
      fragmentErrors: 2,
    });
  });

  it('resets observations after draining but keeps the rendition', () => {
    const batch = new PlaybackTelemetryBatch();
    batch.setHeight(720);
    batch.recordFragment(1000, 50_000);
    batch.recordStall();
    batch.drain();

    expect(batch.drain()).toBeNull();

    batch.recordFragment(1200, 60_000);
    expect(batch.drain()).toEqual({
      height: 720,
      fragments: [{ loadMs: 1200, bytes: 60_000 }],
      stalls: 0,
      fragmentErrors: 0,
    });
  });

  it('keeps only the most recent 100 fragments so the backend never rejects the batch', () => {
    const batch = new PlaybackTelemetryBatch();
    for (let i = 0; i < 130; i++) {
      batch.recordFragment(i, 1000);
    }

    const body = batch.drain();

    expect(body?.fragments).toHaveLength(100);
    // The oldest 30 were dropped, not the newest.
    expect(body?.fragments?.[0].loadMs).toBe(30);
    expect(body?.fragments?.at(-1)?.loadMs).toBe(129);
  });

  it('clamps values to the ranges the backend accepts', () => {
    const batch = new PlaybackTelemetryBatch();
    batch.setHeight(999_999);
    batch.recordFragment(10_000_000, 99_999_999_999);
    batch.recordStartup(10_000_000);

    const body = batch.drain();

    expect(body?.height).toBe(4320);
    expect(body?.fragments?.[0]).toEqual({ loadMs: 600_000, bytes: 1_073_741_824 });
    expect(body?.startupMs).toBe(600_000);
  });

  it('ignores nonsensical readings instead of shipping them', () => {
    const batch = new PlaybackTelemetryBatch();
    batch.recordFragment(Number.NaN, 1000);
    batch.recordFragment(-5, 1000);
    batch.recordFragment(1000, Number.POSITIVE_INFINITY);

    expect(batch.drain()).toBeNull();
  });

  it('records only the first startup measurement of a session', () => {
    const batch = new PlaybackTelemetryBatch();
    batch.recordStartup(2400);
    batch.recordStartup(9999);

    expect(batch.drain()?.startupMs).toBe(2400);
  });

  it('rounds fractional timings, which is what hls.js stats actually produce', () => {
    const batch = new PlaybackTelemetryBatch();
    batch.recordFragment(1234.56, 200_000.4);

    expect(batch.drain()?.fragments?.[0]).toEqual({ loadMs: 1235, bytes: 200_000 });
  });

  it('drops the rendition when the player reports no active level', () => {
    const batch = new PlaybackTelemetryBatch();
    batch.setHeight(720);
    batch.setHeight(null);
    batch.recordStall();

    expect(batch.drain()).toEqual({ stalls: 1, fragmentErrors: 0 });
  });
});
