import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdultContentDialog } from './adult-content-dialog';

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

async function createFixture(open: boolean): Promise<ComponentFixture<AdultContentDialog>> {
  const fixture = TestBed.createComponent(AdultContentDialog);
  fixture.componentRef.setInput('open', open);
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('AdultContentDialog', () => {
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

  it('emits answered(true) when the confirm button is clicked', async () => {
    const fixture = await createFixture(true);
    const answeredSpy = vi.fn();
    fixture.componentInstance.answered.subscribe(answeredSpy);

    const confirmButton = fixture.nativeElement.querySelector(
      '.adult-content-dialog__confirm',
    ) as HTMLButtonElement;
    confirmButton.click();

    expect(answeredSpy).toHaveBeenCalledOnce();
    expect(answeredSpy).toHaveBeenCalledWith(true);
  });

  it('emits answered(false) when the decline button is clicked', async () => {
    const fixture = await createFixture(true);
    const answeredSpy = vi.fn();
    fixture.componentInstance.answered.subscribe(answeredSpy);

    const declineButton = fixture.nativeElement.querySelector(
      '.adult-content-dialog__decline',
    ) as HTMLButtonElement;
    declineButton.click();

    expect(answeredSpy).toHaveBeenCalledOnce();
    expect(answeredSpy).toHaveBeenCalledWith(false);
  });

  it('blocks dismissal via the native cancel event (Escape)', async () => {
    const fixture = await createFixture(true);
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const cancelEvent = new Event('cancel', { cancelable: true });

    dialog.dispatchEvent(cancelEvent);

    expect(cancelEvent.defaultPrevented).toBe(true);
  });
});
