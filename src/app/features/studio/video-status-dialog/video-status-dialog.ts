import { Component, effect, ElementRef, input, output, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import { components } from '@core/api/schema';
import { Tag } from '@shared/tag/tag';
import { videoStatusTone } from '../video-status-tone';

type VideoStatusResponse = components['schemas']['VideoStatusResponse'];

@Component({
  selector: 'app-video-status-dialog',
  imports: [RouterLink, Tag],
  templateUrl: './video-status-dialog.html',
  styleUrl: './video-status-dialog.scss',
})
export class VideoStatusDialog {
  readonly open = input.required<boolean>();
  readonly videoTitle = input.required<string>();
  readonly videoSlug = input<string | null>(null);
  readonly loading = input(false);
  readonly error = input<string | null>(null);
  readonly data = input<VideoStatusResponse | null>(null);

  readonly refreshRequested = output<void>();
  readonly closed = output<void>();

  protected readonly statusTone = videoStatusTone;

  private readonly dialogElement = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    effect(() => {
      const dialog = this.dialogElement()?.nativeElement;
      if (!dialog) {
        return;
      }
      if (this.open()) {
        if (!dialog.open) {
          dialog.showModal();
        }
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogElement()?.nativeElement) {
      this.closed.emit();
    }
  }

  protected onCancel(): void {
    this.closed.emit();
  }
}
