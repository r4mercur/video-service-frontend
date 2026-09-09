import { components } from '@core/api/schema';

export type PlaybackTelemetryRequest = components['schemas']['PlaybackTelemetryRequest'];

/**
 * These mirror the validation constraints on the backend DTO. They are duplicated here on
 * purpose: the endpoint rejects an out-of-range batch with a 400, and because telemetry is
 * fire-and-forget nobody would ever see that failure. Clamping client-side means a pathological
 * reading (a backgrounded tab accumulating for an hour, a bogus stat from a browser quirk)
 * degrades one sample instead of silently dropping the whole batch.
 */
const MAX_FRAGMENTS_PER_BATCH = 100;
const MAX_COUNTER = 10_000;
const MAX_LOAD_MS = 600_000;
const MAX_FRAGMENT_BYTES = 1_073_741_824;
const MAX_STARTUP_MS = 600_000;
const MAX_HEIGHT = 4320;

/**
 * Accumulates what one player observed since the last flush and turns it into a request body.
 *
 * Pure state, no Angular and no timers, so the aggregation rules are unit-testable without a
 * TestBed — which matters because the player itself can only be tested in Playwright (jsdom has
 * neither `<video>` nor MSE, see CLAUDE.md section 8).
 */
export class PlaybackTelemetryBatch {
  private fragments: components['schemas']['FragmentSample'][] = [];
  private stalls = 0;
  private fragmentErrors = 0;
  private startupMs: number | null = null;
  private height: number | null = null;

  /**
   * A fragment the player finished loading. `loadMs` is the full wall-clock load, not just
   * time-to-first-byte: it is the number that decides whether the buffer keeps up, since a
   * segment covering 4 s of video has to arrive in less than 4 s to sustain playback.
   */
  recordFragment(loadMs: number, bytes: number): void {
    if (!isNonNegativeFinite(loadMs) || !isNonNegativeFinite(bytes)) {
      return;
    }
    this.fragments.push({
      loadMs: clamp(Math.round(loadMs), MAX_LOAD_MS),
      bytes: clamp(Math.round(bytes), MAX_FRAGMENT_BYTES),
    });
    // Keep the most recent samples rather than the first ones: if a batch ever overflows, the
    // interesting data is what the player is doing now, not what it did before it got stuck.
    if (this.fragments.length > MAX_FRAGMENTS_PER_BATCH) {
      this.fragments.shift();
    }
  }

  recordStall(): void {
    this.stalls = Math.min(this.stalls + 1, MAX_COUNTER);
  }

  recordFragmentError(): void {
    this.fragmentErrors = Math.min(this.fragmentErrors + 1, MAX_COUNTER);
  }

  /** Time to the first rendered frame. Only the first value of a session is kept. */
  recordStartup(ms: number): void {
    if (this.startupMs !== null || !isNonNegativeFinite(ms)) {
      return;
    }
    this.startupMs = clamp(Math.round(ms), MAX_STARTUP_MS);
  }

  setHeight(height: number | null): void {
    this.height =
      height !== null && isNonNegativeFinite(height) ? clamp(Math.round(height), MAX_HEIGHT) : null;
  }

  /**
   * Returns the batch and resets, or null when there is nothing worth a request. The height
   * alone is not worth reporting - without a single observation attached to it, it says nothing
   * and would just be an empty POST on every tick.
   */
  drain(): PlaybackTelemetryRequest | null {
    const hasObservations =
      this.fragments.length > 0 ||
      this.stalls > 0 ||
      this.fragmentErrors > 0 ||
      this.startupMs !== null;
    if (!hasObservations) {
      return null;
    }

    const body: PlaybackTelemetryRequest = {
      stalls: this.stalls,
      fragmentErrors: this.fragmentErrors,
    };
    if (this.fragments.length > 0) {
      body.fragments = this.fragments;
    }
    if (this.height !== null) {
      body.height = this.height;
    }
    if (this.startupMs !== null) {
      body.startupMs = this.startupMs;
    }

    // Height is session state, not an observation, so it deliberately survives the reset -
    // the next batch belongs to the same rendition unless the player switches.
    this.fragments = [];
    this.stalls = 0;
    this.fragmentErrors = 0;
    this.startupMs = null;

    return body;
  }
}

function isNonNegativeFinite(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function clamp(value: number, max: number): number {
  return Math.min(value, max);
}
