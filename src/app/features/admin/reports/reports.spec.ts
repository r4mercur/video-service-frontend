import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { components } from '@core/api/schema';
import { Reports } from './reports';

type AdminReportDto = components['schemas']['AdminReportDto'];
type CursorPage = components['schemas']['CursorPageAdminReportDto'];

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

function makeReport(overrides: Partial<AdminReportDto> = {}): AdminReportDto {
  return {
    id: 1,
    videoId: 'video-1',
    videoSlug: 'clip',
    videoTitle: 'Clip',
    videoStatus: 'READY',
    reporterUsername: 'alice',
    reason: 'Spam',
    status: 'OPEN',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

/** Settles pending signal effects/renders once no HTTP request is left unflushed. */
async function settle(fixture: ComponentFixture<Reports>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function actionButtons(fixture: ComponentFixture<Reports>): HTMLButtonElement[] {
  const nodeList: NodeListOf<HTMLButtonElement> =
    fixture.nativeElement.querySelectorAll('.reports__action');
  return Array.from(nodeList);
}

describe('Reports', () => {
  let httpMock: HttpTestingController;

  beforeAll(() => polyfillDialog());

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('renders open reports on initial load', async () => {
    const fixture = TestBed.createComponent(Reports);
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/admin/reports' && r.params.get('status') === 'OPEN',
    );
    const page: CursorPage = { items: [makeReport()] };
    req.flush(page);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Clip');
    expect(fixture.nativeElement.querySelectorAll('.reports__row')).toHaveLength(1);
  });

  it('switching tabs requests reports with the new status', async () => {
    const fixture = TestBed.createComponent(Reports);
    fixture.detectChanges();
    httpMock.expectOne((r) => r.params.get('status') === 'OPEN').flush({ items: [] } as CursorPage);
    await settle(fixture);

    (fixture.componentInstance as unknown as { selectTab(status: string): void }).selectTab(
      'REVIEWED',
    );
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.params.get('status') === 'REVIEWED');
    req.flush({
      items: [makeReport({ id: 2, videoTitle: 'Reviewed clip', status: 'REVIEWED' })],
    } as CursorPage);
    await settle(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Reviewed clip');
    expect(fixture.nativeElement.querySelector('.reports__action')?.textContent).not.toContain(
      'Uphold',
    );
  });

  it('blocking a video patches its status and flips the action button', async () => {
    const fixture = TestBed.createComponent(Reports);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.params.get('status') === 'OPEN')
      .flush({ items: [makeReport()] } as CursorPage);
    await settle(fixture);

    const buttons = actionButtons(fixture);
    buttons.find((b) => b.textContent?.trim() === 'Block')?.click();
    await settle(fixture);

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'violates guidelines';
    textarea.dispatchEvent(new Event('input'));
    await settle(fixture);
    (fixture.nativeElement.querySelector('.confirm-dialog__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    const req = httpMock.expectOne('/api/admin/videos/video-1/block');
    expect(req.request.body).toEqual({ reason: 'violates guidelines' });
    req.flush(null);
    await settle(fixture);

    const updatedButtons = actionButtons(fixture);
    expect(updatedButtons.some((b) => b.textContent?.trim() === 'Unblock')).toBe(true);
    expect(updatedButtons.some((b) => b.textContent?.trim() === 'Block')).toBe(false);
  });

  it('deleting a video removes its report from the list', async () => {
    const fixture = TestBed.createComponent(Reports);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.params.get('status') === 'OPEN')
      .flush({ items: [makeReport({ status: 'REVIEWED' })] } as CursorPage);
    await settle(fixture);

    const buttons = actionButtons(fixture);
    buttons.find((b) => b.textContent?.trim() === 'Delete video')?.click();
    await settle(fixture);

    const textarea = fixture.nativeElement.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = 'confirmed policy breach';
    textarea.dispatchEvent(new Event('input'));
    await settle(fixture);
    (fixture.nativeElement.querySelector('.confirm-dialog__confirm') as HTMLButtonElement).click();
    fixture.detectChanges();

    httpMock.expectOne('/api/videos/video-1').flush(null);
    await settle(fixture);

    expect(fixture.nativeElement.querySelectorAll('.reports__row')).toHaveLength(0);
  });

  it('hides the delete action for open reports', async () => {
    const fixture = TestBed.createComponent(Reports);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.params.get('status') === 'OPEN')
      .flush({ items: [makeReport({ status: 'OPEN' })] } as CursorPage);
    await settle(fixture);

    const buttons = actionButtons(fixture);
    expect(buttons.some((b) => b.textContent?.trim() === 'Delete video')).toBe(false);
  });

  it('loads more reports using the next cursor', async () => {
    const fixture = TestBed.createComponent(Reports);
    fixture.detectChanges();
    httpMock
      .expectOne((r) => r.params.get('status') === 'OPEN')
      .flush({ items: [makeReport()], nextCursor: 'cursor-1' } as CursorPage);
    await settle(fixture);

    (
      fixture.nativeElement.querySelector('.reports__load-more-button') as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    const req = httpMock.expectOne(
      (r) => r.url === '/api/admin/reports' && r.params.get('cursor') === 'cursor-1',
    );
    req.flush({ items: [makeReport({ id: 2, videoTitle: 'Second clip' })] } as CursorPage);
    await settle(fixture);

    expect(fixture.nativeElement.querySelectorAll('.reports__row')).toHaveLength(2);
  });
});
