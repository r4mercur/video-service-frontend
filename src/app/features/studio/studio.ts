import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { components } from '@core/api/schema';
import { CategoriesService } from '@core/catalog/categories';
import { isApiProblem } from '@core/http/api-problem';
import { ConfirmDialog } from '@shared/confirm-dialog/confirm-dialog';
import { DurationPipe } from '@shared/pipes/duration';
import { RelativeTimePipe } from '@shared/pipes/relative-time';
import { Tag } from '@shared/tag/tag';
import { StudioApi } from './studio-api';

type VideoDetailDto = components['schemas']['VideoDetailDto'];
type CursorPage = components['schemas']['CursorPageVideoDetailDto'];
type VideoStatus = NonNullable<VideoDetailDto['status']>;
type Visibility = NonNullable<VideoDetailDto['visibility']>;

const PAGE_SIZE = 20;

@Component({
  selector: 'app-studio',
  imports: [RouterLink, Tag, RelativeTimePipe, DurationPipe, ConfirmDialog],
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

  constructor() {
    effect(() => {
      const page = this.initialPage.value();
      if (page) {
        this.videos.set(page.items ?? []);
        this.nextCursor.set(page.nextCursor ?? undefined);
      }
    });
  }

  protected categoryName(video: VideoDetailDto): string {
    return this.categories.nameForSlug(video.categorySlug);
  }

  protected statusTone(
    status: VideoStatus | undefined,
  ): 'accent' | 'danger' | 'success' | 'neutral' {
    switch (status) {
      case 'READY':
        return 'success';
      case 'FAILED':
      case 'BLOCKED':
        return 'danger';
      default:
        return 'neutral';
    }
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
    if (!video.id || this.visibilityPending() !== null) {
      return;
    }
    const next: Visibility = video.visibility === 'PUBLIC' ? 'PRIVATE' : 'PUBLIC';

    this.visibilityPending.set(video.id);
    this.visibilityError.set(null);
    try {
      await this.api.updateVisibility(video.id, next);
      this.videos.update((list) =>
        list.map((item) => (item.id === video.id ? { ...item, visibility: next } : item)),
      );
    } catch (error) {
      this.visibilityError.set(this.describeError(error));
    } finally {
      this.visibilityPending.set(null);
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
    return 'Could not load your videos. Please try again.';
  }
}
