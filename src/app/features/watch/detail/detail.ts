import { DatePipe } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, inject, input } from '@angular/core';
import { components } from '@core/api/schema';
import { CategoriesService } from '@core/catalog/categories';
import { isApiProblem } from '@core/http/api-problem';
import { WatchProgressService } from '@core/watch-progress/watch-progress';
import { DurationPipe } from '@shared/pipes/duration';
import { PlayerFrame } from './player-frame/player-frame';
import { RecommendedRail } from './recommended-rail/recommended-rail';

type VideoDetailDto = components['schemas']['VideoDetailDto'];
type CursorPage = components['schemas']['CursorPageVideoSummaryDto'];

function resolutionLabel(height: number | undefined): string | undefined {
  if (!height) {
    return undefined;
  }
  if (height >= 2160) return '4K';
  if (height >= 1440) return '1440p';
  if (height >= 1080) return '1080p';
  if (height >= 720) return '720p';
  return `${height}p`;
}

const UNAVAILABLE_STATUS_MESSAGE: Record<string, string> = {
  UPLOADING: 'This video is still uploading and isn’t ready to watch yet.',
  PROCESSING: 'This video is still processing and isn’t ready to watch yet.',
  FAILED: 'This video failed to process and can’t be played.',
  BLOCKED: 'This video is not available.',
};

@Component({
  selector: 'app-video-detail',
  imports: [DatePipe, DurationPipe, PlayerFrame, RecommendedRail],
  templateUrl: './detail.html',
  styleUrl: './detail.scss',
})
export class VideoDetail {
  private readonly categories = inject(CategoriesService);
  private readonly watchProgress = inject(WatchProgressService);

  readonly slug = input.required<string>();

  protected readonly video = httpResource<VideoDetailDto>(() => ({
    url: `/api/videos/${this.slug()}`,
  }));

  protected readonly categoryName = computed(() =>
    this.categories.nameForSlug(this.video.value()?.categorySlug),
  );
  protected readonly resolution = computed(() => resolutionLabel(this.video.value()?.height));

  protected readonly unavailableMessage = computed(() => {
    const status = this.video.value()?.status;
    return status ? UNAVAILABLE_STATUS_MESSAGE[status] : undefined;
  });

  protected readonly progress = computed(() => {
    const id = this.video.value()?.id;
    return id ? this.watchProgress.getProgress(id) : null;
  });

  private readonly recommendedFeed = httpResource<CursorPage>(() => {
    const category = this.video.value()?.categorySlug;
    return category ? { url: '/api/videos', params: { category, limit: 5 } } : undefined;
  });

  protected readonly recommended = computed(() => {
    const currentSlug = this.slug();
    return (this.recommendedFeed.value()?.items ?? [])
      .filter((item) => item.slug !== currentSlug)
      .slice(0, 4);
  });

  protected readonly loadError = computed(() => {
    const error = this.video.error();
    return error ? this.describeError(error) : null;
  });

  private describeError(error: unknown): string {
    if (isApiProblem(error)) {
      return error.detail ?? error.title;
    }
    return 'Could not load this video.';
  }
}
