import { Component, computed, input, output } from '@angular/core';
import { FileSizePipe } from '@shared/pipes/file-size';
import { etaSeconds } from '../upload-progress-math';

export type UploadStep = 'transferring' | 'processing' | 'published' | 'failed';

interface StepView {
  readonly title: string;
  readonly note: string;
  readonly state: 'done' | 'active' | 'pending' | 'failed';
}

@Component({
  selector: 'app-upload-progress',
  imports: [FileSizePipe],
  templateUrl: './upload-progress.html',
  styleUrl: './upload-progress.scss',
})
export class UploadProgress {
  readonly fileName = input.required<string>();
  readonly totalBytes = input.required<number>();
  readonly loadedBytes = input.required<number>();
  readonly speedBytesPerSecond = input(0);
  readonly paused = input(false);
  readonly step = input.required<UploadStep>();
  readonly errorMessage = input<string | null>(null);

  /**
   * Prozentsatz vom Transcode-Worker (Pixelzahl-gewichtete Schätzung über die Pipeline-Stufen,
   * kein Byte-Zähler) — deshalb während "processing" keine MB-Anzeige, nur der Balken.
   */
  readonly processingPercent = input<number | null>(null);
  readonly currentStep = input<string | null>(null);

  readonly pauseToggle = output<void>();
  readonly cancelRequested = output<void>();

  protected readonly isProcessing = computed(() => this.step() === 'processing');

  protected readonly percent = computed(() => {
    if (this.isProcessing()) {
      return Math.min(100, Math.max(0, this.processingPercent() ?? 0));
    }
    return this.totalBytes() > 0
      ? Math.min(100, Math.round((this.loadedBytes() / this.totalBytes()) * 100))
      : 0;
  });

  protected readonly remainingSeconds = computed(() => {
    const remaining = this.totalBytes() - this.loadedBytes();
    return etaSeconds(remaining, this.speedBytesPerSecond());
  });

  protected readonly etaLabel = computed(() => {
    const seconds = this.remainingSeconds();
    if (this.paused() || seconds === null) {
      return null;
    }
    const minutes = Math.ceil(seconds / 60);
    return minutes <= 1 ? 'less than a minute left' : `about ${minutes} minutes left`;
  });

  protected readonly steps = computed<StepView[]>(() => {
    const current = this.step();
    return [
      {
        title: 'File transferred',
        note: current === 'transferring' ? `${this.percent()}% — in progress` : 'Done',
        state: current === 'transferring' ? 'active' : 'done',
      },
      {
        title: 'Processing',
        note:
          current === 'transferring'
            ? 'Waiting for the transfer'
            : current === 'processing'
              ? (this.currentStep() ?? 'Converting your video')
              : current === 'failed'
                ? 'Failed'
                : 'Done',
        state:
          current === 'processing'
            ? 'active'
            : current === 'published'
              ? 'done'
              : current === 'failed'
                ? 'failed'
                : 'pending',
      },
      {
        title: 'Published',
        note:
          current === 'published'
            ? 'Live now'
            : current === 'failed'
              ? 'Not reached'
              : 'Waiting for processing',
        state: current === 'published' ? 'done' : current === 'failed' ? 'failed' : 'pending',
      },
    ];
  });
}
