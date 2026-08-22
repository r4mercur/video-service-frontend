import { Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { components } from '@core/api/schema';
import { CategoriesService } from '@core/catalog/categories';
import { WatchProgressService } from '@core/watch-progress/watch-progress';
import { DurationPipe } from '@shared/pipes/duration';
import { RelativeTimePipe } from '@shared/pipes/relative-time';
import { Tag } from '@shared/tag/tag';

type VideoSummaryDto = components['schemas']['VideoSummaryDto'];

@Component({
  selector: 'app-video-row',
  imports: [RouterLink, Tag, RelativeTimePipe, DurationPipe],
  templateUrl: './video-row.html',
  styleUrl: './video-row.scss',
})
export class VideoRow {
  private readonly categories = inject(CategoriesService);
  private readonly watchProgress = inject(WatchProgressService);

  readonly video = input.required<VideoSummaryDto>();

  protected readonly title = computed(() => this.video().title ?? 'Untitled');
  protected readonly slug = computed(() => this.video().slug ?? '');
  protected readonly durationSeconds = computed(() => this.video().durationSeconds ?? 0);
  protected readonly categoryName = computed(() =>
    this.categories.nameForSlug(this.video().categorySlug),
  );

  protected readonly progressPercent = computed(() => {
    const id = this.video().id;
    return id ? this.watchProgress.percentFor(id) : 0;
  });
}
