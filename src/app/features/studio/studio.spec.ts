import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { components } from '@core/api/schema';
import { errorInterceptor } from '@core/http/error';
import { Studio } from './studio';

type VideoDetailDto = components['schemas']['VideoDetailDto'];
type CursorPage = components['schemas']['CursorPageVideoDetailDto'];

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

function makeVideo(overrides: Partial<VideoDetailDto> = {}): VideoDetailDto {
  return {
    id: 'video-1',
    slug: 'clip',
    title: 'Clip',
    status: 'READY',
    visibility: 'PUBLIC',
    categorySlug: 'music',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Settles pending signal effects/renders once no HTTP request is left unflushed. */
async function settle(fixture: ComponentFixture<Studio>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('Studio', () => {
  let httpMock: HttpTestingController;

  beforeAll(() => polyfillDialog());

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  function flushCategories(): void {
    httpMock.expectOne('/api/categories').flush([{ id: 1, slug: 'music', name: 'Music' }]);
  }

  it('renders the current user videos on initial load', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo()] } as CursorPage);
    flushCategories();
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Clip');
    expect(fixture.nativeElement.querySelectorAll('.studio__row')).toHaveLength(1);
  });

  it('shows the empty state when the user has no videos', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock.expectOne((r) => r.url === '/api/me/videos').flush({ items: [] } as CursorPage);
    flushCategories();
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('.studio__empty')).toBeTruthy();
  });

  it('deleting a video removes it from the list after confirmation', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo()] } as CursorPage);
    flushCategories();
    await settle(fixture);

    (fixture.nativeElement.querySelector('.studio__action--danger') as HTMLButtonElement).click();
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('textarea')).toBeFalsy();
    (fixture.nativeElement.querySelector('.confirm-dialog__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    httpMock.expectOne('/api/videos/video-1').flush(null);
    await settle(fixture);

    expect(fixture.nativeElement.querySelectorAll('.studio__row')).toHaveLength(0);
  });

  it('shows an error and keeps the video when deletion fails', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo()] } as CursorPage);
    flushCategories();
    await settle(fixture);

    (fixture.nativeElement.querySelector('.studio__action--danger') as HTMLButtonElement).click();
    await settle(fixture);

    (fixture.nativeElement.querySelector('.confirm-dialog__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    httpMock
      .expectOne('/api/videos/video-1')
      .flush(
        { title: 'Forbidden', status: 403, detail: 'Not your video' },
        { status: 403, statusText: 'Forbidden' },
      );
    await settle(fixture);

    expect(fixture.nativeElement.querySelectorAll('.studio__row')).toHaveLength(1);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Not your video');
  });

  function visibilityButton(fixture: ComponentFixture<Studio>): HTMLButtonElement {
    return fixture.nativeElement.querySelector(
      '.studio__action:not(.studio__action--danger)',
    ) as HTMLButtonElement;
  }

  it('making a private video public updates the visibility tag', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo({ visibility: 'PRIVATE' })] } as CursorPage);
    flushCategories();
    await settle(fixture);

    expect(visibilityButton(fixture).textContent).toContain('Make public');
    visibilityButton(fixture).click();
    await settle(fixture);

    const req = httpMock.expectOne('/api/videos/video-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ visibility: 'PUBLIC' });
    req.flush(null);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('PUBLIC');
    expect(visibilityButton(fixture).textContent).toContain('Make private');
  });

  it('shows the conflict detail and keeps the video private when a report is open', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo({ visibility: 'PRIVATE' })] } as CursorPage);
    flushCategories();
    await settle(fixture);

    visibilityButton(fixture).click();
    await settle(fixture);

    httpMock
      .expectOne('/api/videos/video-1')
      .flush(
        {
          title: 'Conflict',
          status: 409,
          detail: 'Video cannot be made public while a report is open',
        },
        { status: 409, statusText: 'Conflict' },
      );
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Video cannot be made public while a report is open');
    expect(text).toContain('PRIVATE');
  });

  it('loads more videos using the next cursor', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo()], nextCursor: 'cursor-1' } as CursorPage);
    flushCategories();
    await settle(fixture);

    (fixture.nativeElement.querySelector('.studio__load-more-button') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/me/videos' && r.params.get('cursor') === 'cursor-1',
    );
    req.flush({
      items: [makeVideo({ id: 'video-2', slug: 'clip-2', title: 'Second clip' })],
    } as CursorPage);
    await settle(fixture);

    expect(fixture.nativeElement.querySelectorAll('.studio__row')).toHaveLength(2);
  });
});
