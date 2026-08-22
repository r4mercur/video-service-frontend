import { Component, computed, input } from '@angular/core';
import { DurationPipe } from '@shared/pipes/duration';

@Component({
  selector: 'app-player-frame',
  imports: [DurationPipe],
  templateUrl: './player-frame.html',
  styleUrl: './player-frame.scss',
})
export class PlayerFrame {
  readonly positionSeconds = input.required<number>();
  readonly durationSeconds = input.required<number>();
  readonly quality = input.required<string>();

  protected readonly progressPercent = computed(() =>
    Math.round((this.positionSeconds() / this.durationSeconds()) * 100),
  );
}
