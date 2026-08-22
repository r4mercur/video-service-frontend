import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CompactNumberPipe } from '@shared/pipes/compact-number';
import { DurationPipe } from '@shared/pipes/duration';
import { RelativeTimePipe } from '@shared/pipes/relative-time';
import { Tag } from '@shared/tag/tag';
import { VideoSummary, watchProgressLabel } from '../video-summary';

@Component({
  selector: 'app-video-row',
  imports: [RouterLink, Tag, RelativeTimePipe, CompactNumberPipe, DurationPipe],
  templateUrl: './video-row.html',
  styleUrl: './video-row.scss',
})
export class VideoRow {
  readonly video = input.required<VideoSummary>();

  protected readonly progressLabel = computed(() => watchProgressLabel(this.video()));
}
