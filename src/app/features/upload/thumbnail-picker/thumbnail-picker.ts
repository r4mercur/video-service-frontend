import {
  Component,
  DestroyRef,
  ElementRef,
  inject,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_BYTES = 8_000_000; // matches the backend default app.thumbnail.max-size-bytes (8 MB)

/**
 * Purely presentational, analogous to `drop-zone`: only validates type/size and holds a local
 * object-URL preview. The actual `PUT .../thumbnail` call only happens in `upload.ts`,
 * because it needs the videoId from `initiate()`, which this component doesn't know about.
 */
@Component({
  selector: 'app-thumbnail-picker',
  templateUrl: './thumbnail-picker.html',
  styleUrl: './thumbnail-picker.scss',
})
export class ThumbnailPicker {
  readonly file = model<File | null>(null);
  readonly rejected = output<string>();

  protected readonly previewUrl = signal<string | null>(null);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  constructor() {
    inject(DestroyRef).onDestroy(() => this.revokePreview());
  }

  protected openPicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleFile(file);
    }
    input.value = '';
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  protected clear(): void {
    this.revokePreview();
    this.file.set(null);
  }

  private handleFile(file: File): void {
    if (!ACCEPTED_TYPES.has(file.type)) {
      this.rejected.emit('Please choose a JPEG, PNG or WebP image.');
      return;
    }
    if (file.size > MAX_BYTES) {
      this.rejected.emit('This image is larger than 8 MB.');
      return;
    }

    this.revokePreview();
    this.previewUrl.set(URL.createObjectURL(file));
    this.file.set(file);
  }

  private revokePreview(): void {
    const url = this.previewUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.previewUrl.set(null);
    }
  }
}
