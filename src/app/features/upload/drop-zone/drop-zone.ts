import { Component, ElementRef, output, signal, viewChild } from '@angular/core';

const ACCEPTED_TYPES = new Set(['video/mp4', 'video/quicktime', 'video/webm']);
const MAX_BYTES = 8_000_000_000; // "up to 8 GB" laut Mockup-Copy

/**
 * Rein präsentational: validiert nur Typ/Größe und reicht die Datei nach oben durch.
 * Drag&Drop-Events sind Template-Bindings, die nur bei echter Nutzerinteraktion feuern —
 * kein Konflikt mit der SSR-Regel gegen DOM-Zugriff in Constructor/ngOnInit (CLAUDE.md 6.2).
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
