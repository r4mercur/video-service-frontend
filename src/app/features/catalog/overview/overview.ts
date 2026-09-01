import { HttpClient, httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdultContentPreferenceService } from '@core/adult-content-preference/adult-content-preference';
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
  // Only ever read here to fill the includeAgeRestricted query param - whether adult content is
  // shown is decided exclusively by the initial disclaimer dialog's answer (App/AdultContentDialog),
  // deliberately not exposed as an on-page control the visitor could change later.
  private readonly adultContentPreference = inject(AdultContentPreferenceService);

  private readonly initialFeed = httpResource<CursorPage>(() => ({
    url: '/api/videos',
    params: {
      limit: PAGE_SIZE,
      includeAgeRestricted: this.adultContentPreference.includeAdultContent(),
    },
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
        this.http.get<CursorPage>('/api/videos', {
          params: {
            limit: PAGE_SIZE,
            cursor,
            includeAgeRestricted: this.adultContentPreference.includeAdultContent(),
          },
        }),
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
