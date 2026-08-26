import { Component, ElementRef, effect, input, output, signal, viewChild } from '@angular/core';

export interface ReportPayload {
  reason: ReportReason;
  detail?: string;
}

export type ReportReason = 'COPYRIGHT' | 'ILLEGAL_CONTENT' | 'HARASSMENT' | 'SPAM' | 'OTHER';

interface ReasonOption {
  value: ReportReason;
  label: string;
}

const REASON_OPTIONS: ReasonOption[] = [
  { value: 'COPYRIGHT', label: 'Copyright infringement' },
  { value: 'ILLEGAL_CONTENT', label: 'Illegal content' },
  { value: 'HARASSMENT', label: 'Harassment' },
  { value: 'SPAM', label: 'Spam' },
  { value: 'OTHER', label: 'Other' },
];

@Component({
  selector: 'app-report-dialog',
  templateUrl: './report-dialog.html',
  styleUrl: './report-dialog.scss',
})
export class ReportDialog {
  readonly open = input.required<boolean>();
  readonly pending = input(false);
  readonly error = input<string | null>(null);
  readonly succeeded = input(false);

  readonly submitted = output<ReportPayload>();
  readonly cancelled = output<void>();

  protected readonly reasonOptions = REASON_OPTIONS;

  private readonly dialogElement = viewChild<ElementRef<HTMLDialogElement>>('dialogEl');

  protected readonly reason = signal<ReportReason>('COPYRIGHT');
  protected readonly detail = signal('');

  constructor() {
    effect(() => {
      const dialog = this.dialogElement()?.nativeElement;
      if (!dialog) {
        return;
      }
      if (this.open()) {
        this.reason.set('COPYRIGHT');
        this.detail.set('');
        if (!dialog.open) {
          dialog.showModal();
        }
      } else if (dialog.open) {
        dialog.close();
      }
    });
  }

  protected onReasonChange(event: Event): void {
    this.reason.set((event.target as HTMLSelectElement).value as ReportReason);
  }

  protected onDetailInput(event: Event): void {
    this.detail.set((event.target as HTMLTextAreaElement).value);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialogElement()?.nativeElement) {
      this.cancelled.emit();
    }
  }

  protected onCancel(): void {
    this.cancelled.emit();
  }

  protected onSubmit(): void {
    const detail = this.detail().trim();
    this.submitted.emit(detail ? { reason: this.reason(), detail } : { reason: this.reason() });
  }
}
