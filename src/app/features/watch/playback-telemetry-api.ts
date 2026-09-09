import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { ConfigService } from '@core/config/config';
import { PlaybackTelemetryRequest } from './playback-telemetry-batch';

const TELEMETRY_PATH = '/api/playback/telemetry';

/**
 * Ships playback observations to the backend, which converts them into Prometheus metrics.
 *
 * Every call is fire-and-forget and every failure is swallowed. Telemetry exists to explain
 * playback problems; it must never become one. A viewer whose ad blocker, offline state or rate
 * limit kills these requests should notice nothing at all.
 */
@Injectable({ providedIn: 'root' })
export class PlaybackTelemetryApi {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  send(body: PlaybackTelemetryRequest): void {
    try {
      this.http.post<void>(TELEMETRY_PATH, body).subscribe({
        error: () => {
          // Intentionally ignored - see class comment.
        },
      });
    } catch {
      // The apiBaseUrl interceptor resolves the runtime config synchronously on subscribe and
      // throws if it was never loaded, so even starting the request can fail. Also swallowed.
    }
  }

  /**
   * Flush on the way out. A normal XHR is cancelled when the document unloads, which is exactly
   * when the most interesting batch (the one covering the stalls that made the viewer leave) is
   * still pending — `sendBeacon` is the only transport the browser guarantees to finish.
   *
   * Falls back to a regular POST when the beacon is unavailable or refused. Note that a beacon
   * carrying `application/json` is not a CORS-simple request, so it cannot be preflighted and
   * would fail cross-origin; that is fine here because `apiBaseUrl` is empty (same-origin behind
   * the reverse proxy) in both dev and production, and the fallback covers any other setup.
   */
  sendFinal(body: PlaybackTelemetryRequest): void {
    if (!this.isBrowser) {
      return;
    }

    try {
      const url = `${this.config.apiBaseUrl}${TELEMETRY_PATH}`;
      const blob = new Blob([JSON.stringify(body)], { type: 'application/json' });
      // Unload-safe delivery has no DOCUMENT-token or service equivalent, and the call is
      // already guarded by isPlatformBrowser above (CLAUDE.md section 6.1).
      // eslint-disable-next-line no-restricted-globals -- sanctioned exception, see above
      if (navigator.sendBeacon?.(url, blob)) {
        return;
      }
    } catch {
      // Covers a refused beacon and, more importantly, ConfigService throwing when the runtime
      // config was never loaded. This runs on the component-destroy path, where an exception
      // would abort the rest of the teardown - telemetry must never be able to do that.
    }

    this.send(body);
  }
}
