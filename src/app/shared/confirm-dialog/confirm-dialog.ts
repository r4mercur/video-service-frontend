import {
  Component,
  ElementRef,
  computed,
  effect,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: './confirm-dialog.scss',
})
export class ConfirmDialog {
  readonly open = input.required<boolean>();
  readonly title = input.required<string>();
  readonly description = input<string | null>(null);
  readonly confirmLabel = input('Confirm');
  readonly danger = input(false);
  /** Admin moderation actions need an audit-trail reason; plain owner actions (e.g. delete-own-video) don't. */
  readonly requireReason = input(true);

  readonly confirmed = output<string>();
  readonly cancelled = output<void>();

  private readonly dialogElement = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  protected readonly reason = signal('');
  protected readonly touched = signal(false);
  protected readonly reasonInvalid = computed(
    () => this.requireReason() && this.touched() && this.reason().trim().length === 0,
  );

  constructor() {
    effect(() => {
      const dialog = this.dialogElement()?.nativeElement;
      if (!dialog) {
        return;
      }
      if (this.open()) {
        this.reason.set('');
        this.touched.set(false);
        if (!dialog.open) {
          dialog.showModal();
        }
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected onReasonInput(event: Event): void {
    this.reason.set((event.target as HTMLTextAreaElement).value);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogElement()?.nativeElement) {
      this.cancelled.emit();
    }
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  protected onConfirm(): void {
    const trimmed = this.reason().trim();
    if (this.requireReason() && !trimmed) {
      this.touched.set(true);
      return;
    }
    this.confirmed.emit(trimmed);
  }
}
