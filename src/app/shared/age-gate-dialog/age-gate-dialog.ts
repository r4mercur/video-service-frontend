import { Component, ElementRef, afterRenderEffect, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-age-gate-dialog',
  templateUrl: './age-gate-dialog.html',
  styleUrl: './age-gate-dialog.scss',
})
export class AgeGateDialog {
  readonly open = input.required<boolean>();

  readonly confirmed = output<void>();
  readonly declined = output<void>();

  private readonly dialogElement = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  constructor() {
    afterRenderEffect(() => {
      const dialog = this.dialogElement()?.nativeElement;
      if (!dialog) {
        return;
      }
      if (this.open() && !dialog.open) {
        dialog.showModal();
      } else if (!this.open() && dialog.open) {
        dialog.close();
      }
    });
  }

  protected onConfirm(): void {
    this.confirmed.emit();
  }

  protected onDecline(): void {
    this.declined.emit();
  }

  /** Escape fires the native `cancel` event — block it, this gate isn't dismissible. */
  protected onCancel(event: Event): void {
    event.preventDefault();
  }
}
