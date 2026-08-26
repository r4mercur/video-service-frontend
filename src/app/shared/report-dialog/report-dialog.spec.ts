import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ReportDialog } from './report-dialog';

/** jsdom implements HTMLDialogElement's `open` reflection but not `showModal`/`close`. */
function polyfillDialog(): void {
  const proto = globalThis.HTMLDialogElement.prototype;
  if (typeof proto.showModal !== 'function') {
    proto.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '');
    };
  }
  if (typeof proto.close !== 'function') {
    proto.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open');
    };
  }
}

async function createFixture(open: boolean): Promise<ComponentFixture<ReportDialog>> {
  const fixture = TestBed.createComponent(ReportDialog);
  fixture.componentRef.setInput('open', open);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('ReportDialog', () => {
  beforeAll(() => polyfillDialog());

  it('opens the native dialog when `open` is true', async () => {
    const fixture = await createFixture(true);
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
  });

  it('keeps the native dialog closed when `open` is false', async () => {
    const fixture = await createFixture(false);
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);
  });

  it('lists all report reasons in the select', async () => {
    const fixture = await createFixture(true);
    const options = fixture.nativeElement.querySelectorAll(
      '.report-dialog__select option',
    ) as NodeListOf<HTMLOptionElement>;
    expect(Array.from(options).map((option) => option.value)).toEqual([
      'COPYRIGHT',
      'ILLEGAL_CONTENT',
      'HARASSMENT',
      'SPAM',
      'OTHER',
    ]);
  });

  it('submits the default reason without a detail when nothing was entered', async () => {
    const fixture = await createFixture(true);
    const submitSpy = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitSpy);

    const submitButton = fixture.nativeElement.querySelector(
      '.report-dialog__submit',
    ) as HTMLButtonElement;
    submitButton.click();

    expect(submitSpy).toHaveBeenCalledWith({ reason: 'COPYRIGHT' });
  });

  it('submits the selected reason with a trimmed detail', async () => {
    const fixture = await createFixture(true);
    const submitSpy = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitSpy);

    const select = fixture.nativeElement.querySelector(
      '.report-dialog__select',
    ) as HTMLSelectElement;
    select.value = 'SPAM';
    select.dispatchEvent(new Event('change'));

    const textarea = fixture.nativeElement.querySelector(
      '.report-dialog__textarea',
    ) as HTMLTextAreaElement;
    textarea.value = '  looks like spam  ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector(
      '.report-dialog__submit',
    ) as HTMLButtonElement;
    submitButton.click();

    expect(submitSpy).toHaveBeenCalledWith({ reason: 'SPAM', detail: 'looks like spam' });
  });

  it('emits cancelled when the cancel button is clicked', async () => {
    const fixture = await createFixture(true);
    const cancelSpy = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelSpy);

    const cancelButton = fixture.nativeElement.querySelector(
      '.report-dialog__cancel',
    ) as HTMLButtonElement;
    cancelButton.click();

    expect(cancelSpy).toHaveBeenCalledOnce();
  });

  it('shows an error message when `error` is set', async () => {
    const fixture = await createFixture(true);
    fixture.componentRef.setInput('error', 'Could not submit report.');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.report-dialog__error').textContent).toContain(
      'Could not submit report.',
    );
  });

  it('disables the action buttons while pending', async () => {
    const fixture = await createFixture(true);
    fixture.componentRef.setInput('pending', true);
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector(
      '.report-dialog__submit',
    ) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('shows the success view instead of the form when `succeeded` is true', async () => {
    const fixture = await createFixture(true);
    fixture.componentRef.setInput('succeeded', true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.report-dialog__select')).toBeNull();
    expect(fixture.nativeElement.querySelector('.report-dialog__success-icon')).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Report submitted');
  });

  it('emits cancelled when the Done button is clicked after success', async () => {
    const fixture = await createFixture(true);
    fixture.componentRef.setInput('succeeded', true);
    fixture.detectChanges();

    const cancelSpy = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelSpy);

    const doneButton = fixture.nativeElement.querySelector(
      '.report-dialog__submit',
    ) as HTMLButtonElement;
    doneButton.click();

    expect(cancelSpy).toHaveBeenCalledOnce();
  });
});
