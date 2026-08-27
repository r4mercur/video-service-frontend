import { Component, ElementRef, output, signal, viewChild } from '@angular/core';

const ACCEPTED_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const MAX_BYTES = 8_000_000_000; // "up to 8 GB" per the mockup copy

/**
 * Purely presentational: only validates type/size and passes the file up.
 * Drag&drop events are template bindings that only fire on real user interaction —
 * no conflict with the SSR rule against DOM access in the constructor/ngOnInit (CLAUDE.md 6.2).
 */
@Component({
  selector: 'app-drop-zone',
  templateUrl: './drop-zone.html',
  styleUrl: './drop-zone.scss',
})
export class DropZone {
  readonly fileSelected = output<File>();
  readonly rejected = output<string>();

  protected readonly dragging = signal(false);

  private readonly fileInput = viewChild<ElementRef<HTMLInputElement>>('fileInput');

  protected openPicker(): void {
    this.fileInput()?.nativeElement.click();
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(true);
  }

  protected onDragLeave(): void {
    this.dragging.set(false);
  }

  protected onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragging.set(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      this.handleFile(file);
    }
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.handleFile(file);
    }
    input.value = '';
  }

  private handleFile(file: File): void {
    if (!ACCEPTED_TYPES.has(file.type)) {
      this.rejected.emit('Please choose an MP4, MOV or WebM file.');
      return;
    }
    if (file.size > MAX_BYTES) {
      this.rejected.emit('This file is larger than 8 GB.');
      return;
    }
    this.fileSelected.emit(file);
  }
}
