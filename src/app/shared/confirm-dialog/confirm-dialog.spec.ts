import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmDialog } from './confirm-dialog';

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

async function createFixture(open: boolean): Promise<ComponentFixture<ConfirmDialog>> {
  const fixture = TestBed.createComponent(ConfirmDialog);
  fixture.componentRef.setInput('open', open);
  fixture.componentRef.setInput('title', 'Block video');
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('ConfirmDialog', () => {
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

  it('rejects confirmation without a reason', async () => {
    const fixture = await createFixture(true);
    const confirmSpy = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmSpy);

    const confirmButton = fixture.nativeElement.querySelector(
      '.confirm-dialog__confirm',
    ) as HTMLButtonElement;
    confirmButton.click();
    fixture.detectChanges();

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.confirm-dialog__error')).toBeTruthy();
  });

  it('emits the trimmed reason on confirm', async () => {
    const fixture = await createFixture(true);
    const confirmSpy = vi.fn();
    fixture.componentInstance.confirmed.subscribe(confirmSpy);

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = '  spam content  ';
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    const confirmButton = fixture.nativeElement.querySelector(
      '.confirm-dialog__confirm',
    ) as HTMLButtonElement;
    confirmButton.click();

    expect(confirmSpy).toHaveBeenCalledWith('spam content');
  });

  it('emits cancelled without requiring a reason', async () => {
    const fixture = await createFixture(true);
    const cancelSpy = vi.fn();
    fixture.componentInstance.cancelled.subscribe(cancelSpy);

    const cancelButton = fixture.nativeElement.querySelector(
      '.confirm-dialog__cancel',
    ) as HTMLButtonElement;
    cancelButton.click();

    expect(cancelSpy).toHaveBeenCalledOnce();
  });
});
