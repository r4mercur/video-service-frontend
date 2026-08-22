import { Component, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { components } from '@core/api/schema';
import { CategoriesService } from '@core/catalog/categories';
import { DurationPipe } from '@shared/pipes/duration';
import { RelativeTimePipe } from '@shared/pipes/relative-time';

type VideoSummaryDto = components['schemas']['VideoSummaryDto'];

@Component({
  selector: 'app-recommended-rail',
  imports: [RouterLink, DurationPipe, RelativeTimePipe],
  templateUrl: './recommended-rail.html',
  styleUrl: './recommended-rail.scss',
})
export class RecommendedRail {
  protected readonly categories = inject(CategoriesService);

  readonly items = input.required<readonly VideoSummaryDto[]>();
}
