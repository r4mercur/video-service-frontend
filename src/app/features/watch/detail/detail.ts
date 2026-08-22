import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { CompactNumberPipe } from '@shared/pipes/compact-number';
import { DurationPipe } from '@shared/pipes/duration';
import { Tag } from '@shared/tag/tag';
import { PlayerFrame } from './player-frame/player-frame';
import { RecommendedRail } from './recommended-rail/recommended-rail';
import { RECOMMENDED, RecommendedVideo, VIDEO_DETAIL } from './video-detail-data';

@Component({
  selector: 'app-video-detail',
  imports: [Tag, DatePipe, CompactNumberPipe, DurationPipe, PlayerFrame, RecommendedRail],
  templateUrl: './detail.html',
  styleUrl: './detail.scss',
})
export class VideoDetail {
  // Wird derzeit nicht ausgewertet: Die Detailseite zeigt bis zur echten Datenanbindung (AP 4)
  // überall denselben Platzhalter-Datensatz.
  readonly id = input<string>();

  protected readonly video = VIDEO_DETAIL;
  protected readonly recommended: readonly RecommendedVideo[] = RECOMMENDED;
}
