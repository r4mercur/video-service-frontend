import { DOCUMENT } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Listbox, Option } from '@angular/aria/listbox';
import {
  Component,
  DestroyRef,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { components } from '@core/api/schema';
import { WatchProgressService } from '@core/watch-progress/watch-progress';
import { DurationPipe } from '@shared/pipes/duration';
import { PlaybackTelemetryApi } from '../../playback-telemetry-api';
import { PlaybackTelemetryBatch } from '../../playback-telemetry-batch';

const PROGRESS_WRITE_INTERVAL_MS = 5000;
const CONTROLS_AUTOHIDE_DELAY_MS = 4000;

/**
 * Long enough that a normal session sends a handful of small requests rather than a stream of
 * them, short enough that a viewer who gives up after 30 seconds of stalling still reports the
 * stalls that made them leave.
 */
const TELEMETRY_FLUSH_INTERVAL_MS = 15_000;

/**
 * hls.js runs on defaults unless told otherwise, and two of those defaults are actively harmful
 * against a media origin with high time-to-first-byte.
 *
 * `maxTimeToFirstByteMs` defaults to 10000. Measured against production, the object storage
 * origin answered in 6-11 s — so hls.js was abandoning segment requests right at the edge of
 * succeeding, then retrying up to `timeoutRetry.maxNumRetry` (default 4) times, each retry
 * restarting the clock and adding load to an origin that was already the bottleneck. That is
 * exactly the pattern visible in DevTools: segments cancelled at 10.01 s, the same segment
 * requested three or four times. Raising the budget lets a slow-but-successful response land
 * instead of being thrown away; halving the retries keeps the worst case bounded, since a
 * request that has produced nothing in 30 s is genuinely dead rather than merely slow.
 *
 * Trade-off: a truly unreachable origin now takes longer to surface as an error, so a viewer
 * sees the spinner for longer before being told something is wrong. That is the right trade
 * while the origin is slow-but-working, and it should be revisited if origin latency ever
 * returns to normal.
 *
 * hls.js merges user config into defaults with a shallow spread, so `fragLoadPolicy` has to be
 * given in full — a partial object would silently drop `timeoutRetry`/`errorRetry` entirely.
 */
const HLS_CONFIG = {
  fragLoadPolicy: {
    default: {
      maxTimeToFirstByteMs: 30_000,
      maxLoadTimeMs: 120_000,
      timeoutRetry: { maxNumRetry: 2, retryDelayMs: 0, maxRetryDelayMs: 0 },
      errorRetry: { maxNumRetry: 6, retryDelayMs: 1000, maxRetryDelayMs: 8000 },
    },
  },
  // Default is 30 s. A deeper buffer does not make a slow origin faster, but it does give
  // playback more runway to ride out the variance between a fast segment and a slow one.
  maxBufferLength: 60,
} as const;

type ManifestResponse = components['schemas']['ManifestResponse'];
type HlsInstance = import('hls.js').default;

interface QualityLevel {
  index: number;
  height: number;
}

/**
 * iOS WebKit (Safari and Chrome-iOS alike, both run on WebKit) does not support the standard
 * Fullscreen API on arbitrary elements — only the video element's own native fullscreen player,
 * entered/exited through these vendor-prefixed members, which no lib.dom.d.ts version declares.
 */
interface WebkitFullscreenVideoElement extends HTMLVideoElement {
  webkitEnterFullscreen?: () => void;
  webkitExitFullscreen?: () => void;
}

@Component({
  selector: 'app-player-frame',
  imports: [DurationPipe, Listbox, Option],
  templateUrl: './player-frame.html',
  styleUrl: './player-frame.scss',
  host: {
    '(document:fullscreenchange)': 'onFullscreenChange()',
    '(document:click)': 'onDocumentClick($event)',
    '(window:beforeunload)': 'onBeforeUnload()',
  },
})
export class PlayerFrame {
  readonly videoId = input.required<string>();
  readonly posterUrl = input<string | null>(null);
  readonly positionSeconds = input.required<number>();

  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  private readonly watchProgress = inject(WatchProgressService);
  private readonly playerElement = viewChild<ElementRef<HTMLDivElement>>('playerEl');
  private readonly videoElement = viewChild<ElementRef<HTMLVideoElement>>('videoEl');
  private readonly qualityContainer = viewChild<ElementRef<HTMLDivElement>>('qualityContainer');

  protected readonly manifest = httpResource<ManifestResponse>(() => ({
    url: `/api/videos/${this.videoId()}/manifest`,
  }));

  protected readonly playbackError = signal<string | null>(null);
  protected readonly isPlaying = signal(false);
  protected readonly currentTime = signal(0);
  protected readonly duration = signal(0);
  protected readonly volume = signal(1);
  protected readonly muted = signal(false);
  protected readonly isFullscreen = signal(false);

  protected readonly levels = signal<QualityLevel[]>([]);
  protected readonly currentLevelIndex = signal(-1);
  protected readonly activeLevelHeight = signal<number | null>(null);
  protected readonly qualityMenuOpen = signal(false);
  protected readonly controlsVisible = signal(true);
  protected readonly isIosWebkit = signal(false);

  private readonly seekScrub = signal<number | null>(null);
  private readonly volumeScrub = signal<number | null>(null);

  protected readonly displaySeek = computed(() => this.seekScrub() ?? this.currentTime());
  protected readonly displayVolume = computed(
    () => this.volumeScrub() ?? (this.muted() ? 0 : this.volume()),
  );

  protected readonly currentQualityLabel = computed(() => {
    const index = this.currentLevelIndex();
    if (index === -1) {
      const height = this.activeLevelHeight();
      return height ? `Auto (${height}p)` : 'Auto';
    }
    const level = this.levels().find((candidate) => candidate.index === index);
    return level ? `${level.height}p` : 'Auto';
  });

  private hls: HlsInstance | null = null;
  private attachedUrl: string | null = null;
  private listenersBound = false;
  private resumed = false;
  private lastProgressWriteAt = 0;
  private hideControlsTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly telemetryApi = inject(PlaybackTelemetryApi);
  private readonly telemetry = new PlaybackTelemetryBatch();
  private telemetryTimer: ReturnType<typeof setInterval> | null = null;
  private attachStartedAt: number | null = null;

  constructor() {
    afterRenderEffect(() => {
      const video = this.videoElement()?.nativeElement;
      if (!video || this.listenersBound) {
        return;
      }
      this.listenersBound = true;
      this.isIosWebkit.set(this.detectIosWebkit(video));
      this.bindVideoListeners(video);
    });

    afterRenderEffect(() => {
      const video = this.videoElement()?.nativeElement;
      const playlistUrl = this.manifest.value()?.playlistUrl;
      if (!video || !playlistUrl || playlistUrl === this.attachedUrl) {
        return;
      }
      this.attachedUrl = playlistUrl;
      void this.attach(video, playlistUrl);
    });

    this.destroyRef.onDestroy(() => {
      this.hls?.destroy();
      this.clearHideTimer();
      this.stopTelemetry();
    });
  }

  protected onPlayerActivity(): void {
    this.controlsVisible.set(true);
    this.scheduleAutoHide();
  }

  protected togglePlay(): void {
    const video = this.videoElement()?.nativeElement;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }

  protected onSeekInput(event: Event): void {
    const video = this.videoElement()?.nativeElement;
    const value = Number((event.target as HTMLInputElement).value);
    this.seekScrub.set(value);
    if (video) {
      video.currentTime = value;
    }
  }

  protected onSeekCommit(): void {
    this.seekScrub.set(null);
  }

  protected onVolumeInput(event: Event): void {
    const video = this.videoElement()?.nativeElement;
    const value = Number((event.target as HTMLInputElement).value);
    this.volumeScrub.set(value);
    if (video) {
      video.volume = value;
      video.muted = value === 0;
    }
  }

  protected onVolumeCommit(): void {
    this.volumeScrub.set(null);
  }

  protected toggleMute(): void {
    const video = this.videoElement()?.nativeElement;
    if (!video) {
      return;
    }
    video.muted = !video.muted;
  }

  protected toggleFullscreen(): void {
    const container = this.playerElement()?.nativeElement;
    const video = this.videoElement()?.nativeElement as WebkitFullscreenVideoElement | undefined;
    if (!container || !video) {
      return;
    }

    if (this.isIosWebkit()) {
      if (this.isFullscreen()) {
        video.webkitExitFullscreen?.();
      } else {
        video.webkitEnterFullscreen?.();
      }
      return;
    }

    if (this.document.fullscreenElement) {
      void this.document.exitFullscreen();
    } else {
      void container.requestFullscreen();
    }
  }

  protected toggleQualityMenu(): void {
    this.qualityMenuOpen.update((open) => !open);
  }

  protected onQualityChange(indices: readonly number[]): void {
    const index = indices[0];
    if (index !== undefined && this.hls) {
      this.hls.currentLevel = index;
      this.currentLevelIndex.set(index);
    }
    this.qualityMenuOpen.set(false);
    this.scheduleAutoHide();
  }

  protected onQualityKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.qualityMenuOpen()) {
      event.preventDefault();
      this.qualityMenuOpen.set(false);
      this.scheduleAutoHide();
    }
  }

  protected onFullscreenChange(): void {
    this.isFullscreen.set(this.document.fullscreenElement === this.playerElement()?.nativeElement);
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (!this.qualityMenuOpen()) {
      return;
    }
    const container = this.qualityContainer()?.nativeElement;
    if (container && !container.contains(event.target as Node)) {
      this.qualityMenuOpen.set(false);
      this.scheduleAutoHide();
    }
  }

  protected onBeforeUnload(): void {
    const video = this.videoElement()?.nativeElement;
    if (video) {
      this.persistProgress(video);
    }
    this.flushTelemetry(true);
  }

  /**
   * The batch is only worth a request when it actually contains observations, so an idle player
   * (paused, fully buffered) stays silent instead of posting empty bodies every tick.
   */
  private flushTelemetry(isFinal: boolean): void {
    const body = this.telemetry.drain();
    if (!body) {
      return;
    }
    if (isFinal) {
      this.telemetryApi.sendFinal(body);
    } else {
      this.telemetryApi.send(body);
    }
  }

  private stopTelemetry(): void {
    if (this.telemetryTimer !== null) {
      clearInterval(this.telemetryTimer);
      this.telemetryTimer = null;
    }
    this.flushTelemetry(true);
  }

  private bindVideoListeners(video: HTMLVideoElement): void {
    video.addEventListener('play', () => {
      this.isPlaying.set(true);
      this.scheduleAutoHide();
    });
    video.addEventListener('pause', () => {
      this.isPlaying.set(false);
      this.controlsVisible.set(true);
      this.clearHideTimer();
    });
    video.addEventListener('ended', () => {
      this.isPlaying.set(false);
      this.controlsVisible.set(true);
      this.clearHideTimer();
    });
    video.addEventListener('volumechange', () => {
      this.volume.set(video.volume);
      this.muted.set(video.muted);
    });
    video.addEventListener('timeupdate', () => {
      this.currentTime.set(video.currentTime);
      const now = Date.now();
      if (now - this.lastProgressWriteAt >= PROGRESS_WRITE_INTERVAL_MS) {
        this.lastProgressWriteAt = now;
        this.persistProgress(video);
      }
    });
    video.addEventListener('loadedmetadata', () => {
      this.duration.set(video.duration || 0);
      if (!this.resumed && this.positionSeconds() > 0) {
        this.resumed = true;
        video.currentTime = this.positionSeconds();
      }
    });
    video.addEventListener('durationchange', () => this.duration.set(video.duration || 0));
    // Time to first frame. Measured on `loadeddata` rather than on `play`, so the number is the
    // player's readiness and not how long the viewer took to press play - this page does not
    // autoplay, so anchoring on playback would measure the human, not the pipeline.
    video.addEventListener('loadeddata', () => {
      if (this.attachStartedAt !== null) {
        this.telemetry.recordStartup(Date.now() - this.attachStartedAt);
      }
    });
    // iOS's native video fullscreen player fires these on the video element instead of
    // `fullscreenchange` on the document (see `WebkitFullscreenVideoElement`).
    video.addEventListener('webkitbeginfullscreen', () => this.isFullscreen.set(true));
    video.addEventListener('webkitendfullscreen', () => this.isFullscreen.set(false));
  }

  /**
   * iOS WebKit reports `document.fullscreenEnabled === false` (arbitrary elements can't go
   * fullscreen) while still exposing `HTMLVideoElement.webkitEnterFullscreen` on the video
   * itself — that combination is effectively an iOS signature, without reading `navigator`.
   */
  private detectIosWebkit(video: WebkitFullscreenVideoElement): boolean {
    return !this.document.fullscreenEnabled && typeof video.webkitEnterFullscreen === 'function';
  }

  private scheduleAutoHide(): void {
    this.clearHideTimer();
    if (!this.isPlaying()) {
      return;
    }
    this.hideControlsTimer = setTimeout(() => {
      if (this.isPlaying() && !this.qualityMenuOpen()) {
        this.controlsVisible.set(false);
      }
    }, CONTROLS_AUTOHIDE_DELAY_MS);
  }

  private clearHideTimer(): void {
    if (this.hideControlsTimer !== null) {
      clearTimeout(this.hideControlsTimer);
      this.hideControlsTimer = null;
    }
  }

  private persistProgress(video: HTMLVideoElement): void {
    if (!video.duration || Number.isNaN(video.duration)) {
      return;
    }
    this.watchProgress.setProgress(this.videoId(), video.currentTime, video.duration);
  }

  private async attach(video: HTMLVideoElement, playlistUrl: string): Promise<void> {
    this.playbackError.set(null);
    this.hls?.destroy();
    this.hls = null;
    this.levels.set([]);
    this.currentLevelIndex.set(-1);
    this.activeLevelHeight.set(null);

    this.attachStartedAt = Date.now();
    if (this.telemetryTimer === null) {
      this.telemetryTimer = setInterval(
        () => this.flushTelemetry(false),
        TELEMETRY_FLUSH_INTERVAL_MS,
      );
    }

    const { default: Hls } = await import('hls.js');
    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playlistUrl;
        return;
      }
      this.playbackError.set('HLS playback is not supported in this browser.');
      return;
    }

    const hls = new Hls(HLS_CONFIG);
    this.hls = hls;

    // The start level is deliberately left to hls.js's own bandwidth estimate. This used to be
    // pinned to the highest rendition ("start sharp"), which is a fine choice against a fast
    // origin but the worst possible opening move against a slow one: the largest segments are
    // requested first, time out, and ABR then has to scramble down anyway — observed in
    // production as a start at 720p, two failed segments, then a drop to 360p. Starting where
    // the measured bandwidth actually is and climbing costs a few seconds of lower quality and
    // avoids opening with a stall.
    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.levels.set(data.levels.map((level, index) => ({ index, height: level.height })));
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      const level = data.level;
      const height = this.levels().find((candidate) => candidate.index === level)?.height ?? null;
      this.activeLevelHeight.set(height);
      this.telemetry.setHeight(height);
    });

    // The numbers come from hls.js's own load stats, never from the Resource Timing API: the
    // storage origin sends no `Timing-Allow-Origin`, so the browser blanks out sizes and timings
    // for those cross-origin requests (measured: transferSize 0, responseStart == requestStart).
    // hls.js times its own XHRs and is not subject to that.
    hls.on(Hls.Events.FRAG_LOADED, (_event, data) => {
      const stats = data.frag.stats;
      this.telemetry.recordFragment(stats.loading.end - stats.loading.start, stats.loaded);
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
      // Counted before the fatal check on purpose: a segment that times out and is retried
      // successfully is non-fatal, invisible to the viewer as anything but a pause, and exactly
      // the signal worth having. hls.js emits BUFFER_STALLED_ERROR only once per stall period,
      // so this counts stalls rather than ticks of one stall.
      if (
        data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR ||
        data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT
      ) {
        this.telemetry.recordFragmentError();
      } else if (data.details === Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
        this.telemetry.recordStall();
      }

      if (!data.fatal) {
        return;
      }
      switch (data.type) {
        case Hls.ErrorTypes.NETWORK_ERROR:
          hls.startLoad();
          break;
        case Hls.ErrorTypes.MEDIA_ERROR:
          hls.recoverMediaError();
          break;
        default:
          hls.destroy();
          this.hls = null;
          this.playbackError.set('Playback failed. Please reload the page.');
      }
    });

    hls.loadSource(playlistUrl);
    hls.attachMedia(video);
  }
}
