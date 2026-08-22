import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { DurationPipe } from '@shared/pipes/duration';
import { RecommendedVideo } from '../video-detail-data';

@Component({
  selector: 'app-recommended-rail',
  imports: [RouterLink, DurationPipe],
  templateUrl: './recommended-rail.html',
  styleUrl: './recommended-rail.scss',
})
export class RecommendedRail {
  readonly items = input.required<readonly RecommendedVideo[]>();
}
