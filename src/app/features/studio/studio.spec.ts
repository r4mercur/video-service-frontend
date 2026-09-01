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

    expect(fixture.nativeElement.querySelector('.confirm-dialog textarea')).toBeFalsy();
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
    return fixture.nativeElement.querySelector('.studio__action--visibility') as HTMLButtonElement;
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
    req.flush(makeVideo({ visibility: 'PUBLIC' }));
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

    httpMock.expectOne('/api/videos/video-1').flush(
      {
        title: 'Conflict',
        status: 409,
        detail: 'Video cannot be made public while a report is open',
      },
      { status: 409, statusText: 'Conflict' },
    );
    // `applyVideoUpdate()` adds one extra promise hop over calling the API directly, so the
    // error needs an additional microtask flush to reach `visibilityError` before it renders.
    await settle(fixture);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Video cannot be made public while a report is open');
    expect(text).toContain('PRIVATE');
  });

  it('shows a pending state and disables Edit while a visibility migration is in progress', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo({ visibility: 'PRIVATE' })] } as CursorPage);
    flushCategories();
    await settle(fixture);

    visibilityButton(fixture).click();
    await settle(fixture);

    // Backend accepts the PATCH but hasn't finished migrating the object store yet — the
    // response still carries the pre-change visibility.
    httpMock.expectOne('/api/videos/video-1').flush(makeVideo({ visibility: 'PRIVATE' }));
    await settle(fixture);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Updating visibility');
    const editButton = Array.from(fixture.nativeElement.querySelectorAll('.studio__action')).find(
      (button) => (button as HTMLButtonElement).textContent?.trim() === 'Edit',
    ) as HTMLButtonElement | undefined;
    expect(editButton?.disabled).toBe(true);
    expect(visibilityButton(fixture).disabled).toBe(true);

    // Let the migration settle so httpMock.verify() in afterEach doesn't see a dangling request.
    httpMock.expectOne('/api/videos/video-1/status').flush({ status: 'READY' });
    await settle(fixture);
    await settle(fixture);
  });

  it('settles a pending visibility migration once the backend confirms the target', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo({ visibility: 'PRIVATE' })] } as CursorPage);
    flushCategories();
    await settle(fixture);

    visibilityButton(fixture).click();
    await settle(fixture);

    httpMock.expectOne('/api/videos/video-1').flush(makeVideo({ visibility: 'PRIVATE' }));
    await settle(fixture);
    await settle(fixture);

    httpMock.expectOne('/api/videos/video-1/status').flush({ status: 'READY' });
    await settle(fixture);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('PUBLIC');
    expect(text).not.toContain('Updating visibility');
    expect(visibilityButton(fixture).disabled).toBe(false);
  });

  it('shows an error and keeps the old visibility when the migration fails', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo({ visibility: 'PRIVATE' })] } as CursorPage);
    flushCategories();
    await settle(fixture);

    visibilityButton(fixture).click();
    await settle(fixture);

    httpMock.expectOne('/api/videos/video-1').flush(makeVideo({ visibility: 'PRIVATE' }));
    await settle(fixture);
    await settle(fixture);

    httpMock
      .expectOne('/api/videos/video-1/status')
      .flush({ status: 'READY', lastError: 'Object store migration failed' });
    await settle(fixture);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Object store migration failed');
    expect(text).toContain('PRIVATE');
    expect(text).not.toContain('Updating visibility');
    expect(visibilityButton(fixture).disabled).toBe(false);
  });

  it('stops polling for a visibility migration once the component is destroyed', async () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(Studio);
      fixture.detectChanges();

      httpMock
        .expectOne((r) => r.url === '/api/me/videos')
        .flush({ items: [makeVideo({ visibility: 'PRIVATE' })] } as CursorPage);
      flushCategories();
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      visibilityButton(fixture).click();
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      httpMock.expectOne('/api/videos/video-1').flush(makeVideo({ visibility: 'PRIVATE' }));
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      // Still mid-migration — this schedules a follow-up poll 5s out via setTimeout.
      httpMock
        .expectOne('/api/videos/video-1/status')
        .flush({ status: 'READY', visibilityTarget: 'PUBLIC' });
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();

      fixture.destroy();

      await vi.advanceTimersByTimeAsync(10_000);

      httpMock.expectNone('/api/videos/video-1/status');
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the status button only for videos that are not READY yet', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({
        items: [
          makeVideo({ id: 'video-1', status: 'READY' }),
          makeVideo({ id: 'video-2', slug: undefined, status: 'PROCESSING' }),
        ],
      } as CursorPage);
    flushCategories();
    await settle(fixture);

    const rows = fixture.nativeElement.querySelectorAll('.studio__row');
    expect(rows[0].textContent).not.toContain('View status');
    expect(rows[1].textContent).toContain('View status');
  });

  it('opens the status dialog and shows the fetched status', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({
        items: [makeVideo({ id: 'video-2', slug: undefined, status: 'PROCESSING' })],
      } as CursorPage);
    flushCategories();
    await settle(fixture);

    const statusButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.studio__action'),
    ) as HTMLButtonElement[];
    const statusButton = statusButtons.find((button) =>
      button.textContent?.includes('View status'),
    );
    statusButton?.click();
    fixture.detectChanges();

    httpMock
      .expectOne('/api/videos/video-2/status')
      .flush({ status: 'PROCESSING', progressPercent: 55, currentStep: 'Transcoding' });
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('55%');
    expect(text).toContain('Transcoding');
  });

  it('refetches the status when refresh is clicked in the status dialog', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({
        items: [makeVideo({ id: 'video-2', slug: undefined, status: 'PROCESSING' })],
      } as CursorPage);
    flushCategories();
    await settle(fixture);

    const statusButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.studio__action'),
    ) as HTMLButtonElement[];
    statusButtons.find((button) => button.textContent?.includes('View status'))?.click();
    fixture.detectChanges();

    httpMock
      .expectOne('/api/videos/video-2/status')
      .flush({ status: 'PROCESSING', progressPercent: 10 });
    await settle(fixture);

    (
      fixture.nativeElement.querySelector('.video-status-dialog__refresh') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    httpMock.expectOne('/api/videos/video-2/status').flush({ status: 'READY' });
    await settle(fixture);

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('is ready');
  });

  it('opens the edit dialog prefilled with the video being edited', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo({ title: 'Original title' })] } as CursorPage);
    flushCategories();
    await settle(fixture);

    const editButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.studio__action'),
    ) as HTMLButtonElement[];
    editButtons.find((button) => button.textContent?.trim() === 'Edit')?.click();
    await settle(fixture);

    const title = fixture.nativeElement.querySelector('#edit-title') as HTMLInputElement;
    expect(title.value).toBe('Original title');
  });

  it('saving an edit replaces the video with the server response', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo({ title: 'Original title' })] } as CursorPage);
    flushCategories();
    await settle(fixture);

    const editButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.studio__action'),
    ) as HTMLButtonElement[];
    editButtons.find((button) => button.textContent?.trim() === 'Edit')?.click();
    await settle(fixture);

    const title = fixture.nativeElement.querySelector('#edit-title') as HTMLInputElement;
    title.value = 'Updated title';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector('.edit-metadata-dialog__panel') as HTMLFormElement
    ).requestSubmit();
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/videos/video-1');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      title: 'Updated title',
      categoryId: 1,
      visibility: 'PUBLIC',
      description: '',
    });
    req.flush(makeVideo({ title: 'Updated title' }));
    // `applyVideoUpdate()` adds one extra promise hop over calling the API directly, so closing
    // the dialog needs an additional microtask flush to land before it renders.
    await settle(fixture);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Updated title');
    expect(fixture.nativeElement.querySelector('.edit-metadata-dialog[open]')).toBeFalsy();
  });

  it('shows an inline error in the edit dialog when saving fails', async () => {
    const fixture = TestBed.createComponent(Studio);
    fixture.detectChanges();

    httpMock
      .expectOne((r) => r.url === '/api/me/videos')
      .flush({ items: [makeVideo()] } as CursorPage);
    flushCategories();
    await settle(fixture);

    const editButtons = Array.from(
      fixture.nativeElement.querySelectorAll('.studio__action'),
    ) as HTMLButtonElement[];
    editButtons.find((button) => button.textContent?.trim() === 'Edit')?.click();
    await settle(fixture);

    (
      fixture.nativeElement.querySelector('.edit-metadata-dialog__panel') as HTMLFormElement
    ).requestSubmit();
    fixture.detectChanges();

    httpMock.expectOne('/api/videos/video-1').flush(
      {
        title: 'Conflict',
        status: 409,
        detail: 'Video cannot be made public while a report is open',
      },
      { status: 409, statusText: 'Conflict' },
    );
    // `applyVideoUpdate()` adds one extra promise hop over calling the API directly, so the
    // error needs an additional microtask flush to reach `editError` before it renders.
    await settle(fixture);
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('.edit-metadata-dialog__error')?.textContent,
    ).toContain('Video cannot be made public while a report is open');
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
