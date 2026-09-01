import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { components } from '@core/api/schema';
import { VideoStatusDialog } from './video-status-dialog';

type VideoStatusResponse = components['schemas']['VideoStatusResponse'];

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

async function createFixture(): Promise<ComponentFixture<VideoStatusDialog>> {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(VideoStatusDialog);
  fixture.componentRef.setInput('open', true);
  fixture.componentRef.setInput('videoTitle', 'My clip');
  fixture.detectChanges();
  await fixture.whenStable();
  return fixture;
}

describe('VideoStatusDialog', () => {
  beforeAll(() => polyfillDialog());

  it('opens the native dialog when `open` is true', async () => {
    const fixture = await createFixture();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
  });

  it('shows a loading state', async () => {
    const fixture = await createFixture();
    fixture.componentRef.setInput('loading', true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Loading status');
  });

  it('shows a progress bar and current step while processing', async () => {
    const fixture = await createFixture();
    const data: VideoStatusResponse = {
      status: 'PROCESSING',
      progressPercent: 42,
      currentStep: 'Transcoding 720p',
    };
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('42%');
    expect(text).toContain('Transcoding 720p');
  });

  it('shows a hint without a progress bar while uploading', async () => {
    const fixture = await createFixture();
    fixture.componentRef.setInput('data', { status: 'UPLOADING' } as VideoStatusResponse);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.video-status-dialog__bar')).toBeFalsy();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('still uploading');
  });

  it('shows the last error and a delete hint when failed', async () => {
    const fixture = await createFixture();
    const data: VideoStatusResponse = { status: 'FAILED', lastError: 'Unsupported codec' };
    fixture.componentRef.setInput('data', data);
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Unsupported codec');
    expect(text).toContain('delete this video');
  });

  it('shows a watch link once the video is ready', async () => {
    const fixture = await createFixture();
    fixture.componentRef.setInput('videoSlug', 'my-clip');
    fixture.componentRef.setInput('data', { status: 'READY' } as VideoStatusResponse);
    fixture.detectChanges();

    const link = fixture.nativeElement.querySelector(
      '.video-status-dialog__watch',
    ) as HTMLAnchorElement;
    expect(link).toBeTruthy();
  });

  it('emits refreshRequested when the refresh button is clicked', async () => {
    const fixture = await createFixture();
    const refreshSpy = vi.fn();
    fixture.componentInstance.refreshRequested.subscribe(refreshSpy);

    (
      fixture.nativeElement.querySelector('.video-status-dialog__refresh') as HTMLButtonElement
    ).click();

    expect(refreshSpy).toHaveBeenCalledOnce();
  });

  it('emits closed when the close button is clicked', async () => {
    const fixture = await createFixture();
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    (
      fixture.nativeElement.querySelector('.video-status-dialog__close') as HTMLButtonElement
    ).click();

    expect(closedSpy).toHaveBeenCalledOnce();
  });
});
