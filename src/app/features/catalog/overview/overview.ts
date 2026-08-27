import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { components } from '@core/api/schema';
import { isApiProblem } from '@core/http/api-problem';
import { firstValueFrom } from 'rxjs';
import { VideoRow } from './video-row/video-row';

type VideoSummaryDto = components['schemas']['VideoSummaryDto'];
type CursorPage = components['schemas']['CursorPageVideoSummaryDto'];

const PAGE_SIZE = 12;

@Component({
  selector: 'app-overview',
  imports: [RouterLink, VideoRow],
  templateUrl: './overview.html',
  styleUrl: './overview.scss',
})
export class Overview {
  private readonly http = inject(HttpClient);

  private readonly initialFeed = httpResource<CursorPage>(() => ({
    url: '/api/videos',
    params: { limit: PAGE_SIZE },
  }));

  protected readonly videos = signal<VideoSummaryDto[]>([]);
  protected readonly nextCursor = signal<string | undefined>(undefined);
  protected readonly loadingMore = signal(false);
  protected readonly loadMoreError = signal<string | null>(null);

  protected readonly hasMore = computed(() => this.nextCursor() !== undefined);
  protected readonly initialLoading = this.initialFeed.isLoading;
  protected readonly initialError = computed(() => {
    const error = this.initialFeed.error();
    return error ? this.describeError(error) : null;
  });

  constructor() {
    effect(() => {
      const page = this.initialFeed.value();
      if (page) {
        this.videos.set(page.items ?? []);
        // When there's no next page, the backend explicitly returns "nextCursor": null
        // rather than omitting the field — normalize that to undefined.
        this.nextCursor.set(page.nextCursor ?? undefined);
      }
    });
  }

  protected async loadMore(): Promise<void> {
    const cursor = this.nextCursor();
    if (!cursor || this.loadingMore()) {
      return;
    }

    this.loadingMore.set(true);
    this.loadMoreError.set(null);
    try {
      const page = await firstValueFrom(
        this.http.get<CursorPage>('/api/videos', { params: { limit: PAGE_SIZE, cursor } }),
      );
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
    return 'Could not load videos. Please try again.';
  }
}
