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

const PROGRESS_WRITE_INTERVAL_MS = 5000;
const CONTROLS_AUTOHIDE_DELAY_MS = 4000;

type ManifestResponse = components['schemas']['ManifestResponse'];
type HlsInstance = import('hls.js').default;

interface QualityLevel {
  index: number;
  height: number;
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

  constructor() {
    afterRenderEffect(() => {
      const video = this.videoElement()?.nativeElement;
      if (!video || this.listenersBound) {
        return;
      }
      this.listenersBound = true;
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
    if (!container) {
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

    const { default: Hls } = await import('hls.js');
    if (!Hls.isSupported()) {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = playlistUrl;
        return;
      }
      this.playbackError.set('HLS playback is not supported in this browser.');
      return;
    }

    const hls = new Hls();
    this.hls = hls;

    hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
      this.levels.set(data.levels.map((level, index) => ({ index, height: level.height })));
      const highestIndex = data.levels.reduce(
        (best, level, index) => (level.height > data.levels[best].height ? index : best),
        0,
      );
      hls.startLevel = highestIndex;
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
      const level = data.level;
      const height = this.levels().find((candidate) => candidate.index === level)?.height ?? null;
      this.activeLevelHeight.set(height);
    });

    hls.on(Hls.Events.ERROR, (_event, data) => {
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
