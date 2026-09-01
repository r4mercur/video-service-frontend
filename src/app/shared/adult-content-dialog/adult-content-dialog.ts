import { afterRenderEffect, Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-adult-content-dialog',
  templateUrl: './adult-content-dialog.html',
  styleUrl: './adult-content-dialog.scss',
})
export class AdultContentDialog {
  readonly open = input.required<boolean>();

  readonly answered = output<boolean>();

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

  protected onAnswer(includeAdultContent: boolean): void {
    this.answered.emit(includeAdultContent);
  }

  /** Escape fires the native `cancel` event — block it, this isn't dismissible without an answer. */
  protected onCancel(event: Event): void {
    event.preventDefault();
  }
}
