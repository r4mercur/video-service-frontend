import { httpResource } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { components } from '@core/api/schema';
import { CategoriesService } from '@core/catalog/categories';
import { isApiProblem } from '@core/http/api-problem';
import { ConfirmDialog } from '@shared/confirm-dialog/confirm-dialog';
import { DurationPipe } from '@shared/pipes/duration';
import { RelativeTimePipe } from '@shared/pipes/relative-time';
import { Tag } from '@shared/tag/tag';
import { EditMetadataDialog } from './edit-metadata-dialog/edit-metadata-dialog';
import { StudioApi } from './studio-api';
import { VideoStatusDialog } from './video-status-dialog/video-status-dialog';
import { videoStatusTone } from './video-status-tone';

type VideoDetailDto = components['schemas']['VideoDetailDto'];
type CursorPage = components['schemas']['CursorPageVideoDetailDto'];
type Visibility = NonNullable<VideoDetailDto['visibility']>;
type VideoStatusResponse = components['schemas']['VideoStatusResponse'];
type UpdateVideoRequest = components['schemas']['UpdateVideoRequest'];

const PAGE_SIZE = 20;
const VISIBILITY_POLL_INTERVAL_MS = 5000;

@Component({
  selector: 'app-studio',
  imports: [
    RouterLink,
    Tag,
    RelativeTimePipe,
    DurationPipe,
    ConfirmDialog,
    VideoStatusDialog,
    EditMetadataDialog,
  ],
  templateUrl: './studio.html',
  styleUrl: './studio.scss',
})
export class Studio {
  private readonly api = inject(StudioApi);
  private readonly categories = inject(CategoriesService);

  private readonly initialPage = httpResource<CursorPage>(() => ({
    url: '/api/me/videos',
    params: { limit: PAGE_SIZE },
  }));

  protected readonly videos = signal<VideoDetailDto[]>([]);
  protected readonly nextCursor = signal<string | undefined>(undefined);
  protected readonly loadingMore = signal(false);
  protected readonly loadMoreError = signal<string | null>(null);

  protected readonly hasMore = computed(() => this.nextCursor() !== undefined);
  protected readonly initialLoading = this.initialPage.isLoading;
  protected readonly initialError = computed(() => {
    const error = this.initialPage.error();
    return error ? this.describeError(error) : null;
  });

  protected readonly pendingDelete = signal<VideoDetailDto | null>(null);
  protected readonly deleteInFlight = signal(false);
  protected readonly deleteError = signal<string | null>(null);

  protected readonly visibilityPending = signal<string | null>(null);
  protected readonly visibilityError = signal<string | null>(null);

  protected readonly dialogOpen = computed(() => this.pendingDelete() !== null);
  protected readonly dialogTitle = computed(() => {
    const title = this.pendingDelete()?.title ?? 'this video';
    return `Delete "${title}"`;
  });

  protected readonly statusDialogVideo = signal<VideoDetailDto | null>(null);
  protected readonly statusLoading = signal(false);
  protected readonly statusError = signal<string | null>(null);
  protected readonly statusData = signal<VideoStatusResponse | null>(null);

  protected readonly statusDialogOpen = computed(() => this.statusDialogVideo() !== null);
  protected readonly statusDialogTitle = computed(() => this.statusDialogVideo()?.title ?? '');
  protected readonly statusDialogSlug = computed(() => this.statusDialogVideo()?.slug ?? null);

  protected readonly statusTone = videoStatusTone;

  protected readonly editDialogVideo = signal<VideoDetailDto | null>(null);
  protected readonly editSaving = signal(false);
  protected readonly editError = signal<string | null>(null);

  protected readonly editDialogOpen = computed(() => this.editDialogVideo() !== null);

  protected readonly visibilityMigratingIds = signal<ReadonlySet<string>>(new Set());
  private readonly visibilityPollTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor() {
    effect(() => {
      const page = this.initialPage.value();
      if (page) {
        this.videos.set(page.items ?? []);
        this.nextCursor.set(page.nextCursor ?? undefined);
      }
    });

    inject(DestroyRef).onDestroy(() => {
      for (const timer of this.visibilityPollTimers.values()) {
        clearTimeout(timer);
      }
      this.visibilityPollTimers.clear();
    });
  }

  protected isVisibilityMigrating(video: VideoDetailDto): boolean {
    return video.id !== undefined && this.visibilityMigratingIds().has(video.id);
  }

  protected categoryName(video: VideoDetailDto): string {
    return this.categories.nameForSlug(video.categorySlug);
  }

  protected requestDelete(video: VideoDetailDto): void {
    this.deleteError.set(null);
    this.pendingDelete.set(video);
  }

  protected cancelDelete(): void {
    this.pendingDelete.set(null);
  }

  protected async confirmDelete(): Promise<void> {
    const video = this.pendingDelete();
    if (!video?.id) {
      return;
    }

    this.deleteInFlight.set(true);
    this.deleteError.set(null);
    try {
      await this.api.deleteVideo(video.id);
      this.videos.update((list) => list.filter((item) => item.id !== video.id));
      this.pendingDelete.set(null);
    } catch (error) {
      this.deleteError.set(this.describeError(error));
    } finally {
      this.deleteInFlight.set(false);
    }
  }

  protected async toggleVisibility(video: VideoDetailDto): Promise<void> {
    if (!video.id || this.visibilityPending() !== null || this.isVisibilityMigrating(video)) {
      return;
    }
    const next: Visibility = video.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';

    this.visibilityPending.set(video.id);
    this.visibilityError.set(null);
    try {
      await this.applyVideoUpdate(video.id, { visibility: next });
    } catch (error) {
      this.visibilityError.set(this.describeError(error));
    } finally {
      this.visibilityPending.set(null);
    }
  }

  protected openEditDialog(video: VideoDetailDto): void {
    this.editError.set(null);
    this.editDialogVideo.set(video);
  }

  protected closeEditDialog(): void {
    this.editDialogVideo.set(null);
  }

  protected async saveEdit(patch: UpdateVideoRequest): Promise<void> {
    const video = this.editDialogVideo();
    if (!video?.id) {
      return;
    }

    this.editSaving.set(true);
    this.editError.set(null);
    try {
      await this.applyVideoUpdate(video.id, patch);
      this.editDialogVideo.set(null);
    } catch (error) {
      this.editError.set(this.describeError(error));
    } finally {
      this.editSaving.set(false);
    }
  }

  /**
   * PATCHes a video and, if the backend accepted a visibility change but hasn't applied it yet
   * (an object-store migration can take minutes for large videos — see
   * `VideoStatusResponse.visibilityTarget`), polls `.../status` until it settles instead of
   * trusting the immediate response body. Other fields (title/category/description) are always
   * applied synchronously, so those are taken from the immediate response either way.
   */
  private async applyVideoUpdate(videoId: string, patch: UpdateVideoRequest): Promise<void> {
    const initial = await this.api.updateVideo(videoId, patch);
    this.replaceVideo(initial);

    if (patch.visibility === undefined || initial.visibility === patch.visibility) {
      return;
    }

    const target = patch.visibility;
    this.setVisibilityMigrating(videoId, true);
    try {
      await this.pollVisibilityMigration(videoId, target);
    } finally {
      this.setVisibilityMigrating(videoId, false);
    }
  }

  private pollVisibilityMigration(videoId: string, target: Visibility): Promise<void> {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const status = await this.api.status(videoId);
          if (status.lastError) {
            reject(new Error(status.lastError));
            return;
          }
          if (!status.visibilityTarget) {
            this.videos.update((list) =>
              list.map((item) => (item.id === videoId ? { ...item, visibility: target } : item)),
            );
            resolve();
            return;
          }
        } catch {
          // A network hiccup during polling is not a reason to give up — just try again.
        }
        this.visibilityPollTimers.set(
          videoId,
          setTimeout(() => void poll(), VISIBILITY_POLL_INTERVAL_MS),
        );
      };
      void poll();
    });
  }

  private setVisibilityMigrating(videoId: string, migrating: boolean): void {
    this.visibilityMigratingIds.update((current) => {
      const next = new Set(current);
      if (migrating) {
        next.add(videoId);
      } else {
        next.delete(videoId);
        clearTimeout(this.visibilityPollTimers.get(videoId));
        this.visibilityPollTimers.delete(videoId);
      }
      return next;
    });
  }

  private replaceVideo(updated: VideoDetailDto): void {
    this.videos.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
  }

  protected openStatusDialog(video: VideoDetailDto): void {
    if (!video.id) {
      return;
    }
    this.statusDialogVideo.set(video);
    void this.loadStatus(video.id);
  }

  protected closeStatusDialog(): void {
    this.statusDialogVideo.set(null);
    this.statusData.set(null);
    this.statusError.set(null);
  }

  protected refreshStatus(): void {
    const videoId = this.statusDialogVideo()?.id;
    if (videoId) {
      void this.loadStatus(videoId);
    }
  }

  private async loadStatus(videoId: string): Promise<void> {
    this.statusLoading.set(true);
    this.statusError.set(null);
    try {
      this.statusData.set(await this.api.status(videoId));
    } catch (error) {
      this.statusError.set(this.describeError(error));
    } finally {
      this.statusLoading.set(false);
    }
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) {
      return;
    }

    this.loadingMore.set(true);
    this.loadMoreError.set(null);
    try {
      const page = await this.api.myVideos({ limit: PAGE_SIZE, cursor });
      this.videos.update((existing) => [...existing, ...(page.items ?? [])]);
      this.nextCursor.set(page.nextCursor ?? undefined);
    } catch (error) {
      this.loadMoreError.set(this.describeError(error));
    } finally {
      this.loadingMore.set(false);
    }
  }

  private describeError(error: unknown): string {
    if (isApiProblem(error)) {
      return error.detail ?? error.title;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Could not load your videos. Please try again.';
  }
}
