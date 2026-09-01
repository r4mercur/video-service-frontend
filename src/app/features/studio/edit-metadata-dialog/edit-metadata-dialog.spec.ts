import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { components } from '@core/api/schema';
import { EditMetadataDialog } from './edit-metadata-dialog';

type VideoDetailDto = components['schemas']['VideoDetailDto'];

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
    title: 'Original title',
    description: 'Original description',
    categorySlug: 'music',
    visibility: 'PUBLIC',
    ...overrides,
  };
}

function flushCategories(httpMock: HttpTestingController): void {
  httpMock.expectOne('/api/categories').flush([
    { id: 1, slug: 'music', name: 'Music' },
    { id: 2, slug: 'sport', name: 'Sport' },
  ]);
}

/** Settles pending signal effects/renders once no HTTP request is left unflushed. */
async function settle(fixture: ComponentFixture<EditMetadataDialog>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

async function createFixture(
  httpMock: HttpTestingController,
  video: VideoDetailDto,
): Promise<ComponentFixture<EditMetadataDialog>> {
  const fixture = TestBed.createComponent(EditMetadataDialog);
  fixture.componentRef.setInput('open', true);
  fixture.detectChanges();
  flushCategories(httpMock);
  fixture.componentRef.setInput('video', video);
  await settle(fixture);
  return fixture;
}

describe('EditMetadataDialog', () => {
  let httpMock: HttpTestingController;

  beforeAll(() => polyfillDialog());

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('prefills the form from the given video, including the resolved category', async () => {
    const fixture = await createFixture(httpMock, makeVideo());

    const title = fixture.nativeElement.querySelector('#edit-title') as HTMLInputElement;
    const description = fixture.nativeElement.querySelector(
      '#edit-description',
    ) as HTMLTextAreaElement;
    expect(title.value).toBe('Original title');
    expect(description.value).toBe('Original description');
    expect(fixture.nativeElement.querySelector('.category-select__trigger')?.textContent).toContain(
      'Music',
    );
  });

  it('rejects submission with an empty title and does not emit', async () => {
    const fixture = await createFixture(httpMock, makeVideo());

    const savedSpy = vi.fn();
    fixture.componentInstance.saved.subscribe(savedSpy);

    const title = fixture.nativeElement.querySelector('#edit-title') as HTMLInputElement;
    title.value = '';
    title.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();

    expect(savedSpy).not.toHaveBeenCalled();
    expect(fixture.nativeElement.querySelector('.edit-metadata-dialog__field-error')).toBeTruthy();
  });

  it('emits the edited fields on submit, sending an explicit empty description rather than omitting it', async () => {
    const fixture = await createFixture(httpMock, makeVideo());

    const savedSpy = vi.fn();
    fixture.componentInstance.saved.subscribe(savedSpy);

    const title = fixture.nativeElement.querySelector('#edit-title') as HTMLInputElement;
    title.value = 'Updated title';
    title.dispatchEvent(new Event('input'));

    const description = fixture.nativeElement.querySelector(
      '#edit-description',
    ) as HTMLTextAreaElement;
    description.value = '';
    description.dispatchEvent(new Event('input'));
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('form') as HTMLFormElement).requestSubmit();
    fixture.detectChanges();

    expect(savedSpy).toHaveBeenCalledWith({
      title: 'Updated title',
      categoryId: 1,
      visibility: 'PUBLIC',
      description: '',
    });
  });

  it('emits closed when cancel is clicked', async () => {
    const fixture = await createFixture(httpMock, makeVideo());

    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    (
      fixture.nativeElement.querySelector('.edit-metadata-dialog__cancel') as HTMLButtonElement
    ).click();

    expect(closedSpy).toHaveBeenCalledOnce();
  });

  it('shows the error input when set', async () => {
    const fixture = await createFixture(httpMock, makeVideo());
    fixture.componentRef.setInput('error', 'Video cannot be made public while a report is open');
    await settle(fixture);

    expect(
      fixture.nativeElement.querySelector('.edit-metadata-dialog__error')?.textContent,
    ).toContain('Video cannot be made public while a report is open');
  });
});
