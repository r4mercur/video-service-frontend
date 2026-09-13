import { ViewportScroller } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { components } from '@core/api/schema';
import { CategoriesService } from '@core/catalog/categories';
import { Search } from './search';

type SearchPage = components['schemas']['PageResponseVideoSummaryDto'];
type VideoSummaryDto = components['schemas']['VideoSummaryDto'];

function makeVideo(index: number): VideoSummaryDto {
  return {
    id: `video-${index}`,
    slug: `clip-${index}`,
    title: `Kubernetes clip ${index}`,
    durationSeconds: 60,
    categorySlug: 'gaming',
    ownerUsername: 'alice',
    publishedAt: new Date().toISOString(),
    ageRestricted: false,
  };
}

function makePage(overrides: Partial<SearchPage> = {}): SearchPage {
  return { items: [makeVideo(1)], page: 1, size: 50, totalItems: 1, totalPages: 1, ...overrides };
}

/** Settles pending signal effects/renders once no HTTP request is left unflushed. */
async function settle(fixture: ComponentFixture<Search>): Promise<void> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

function createSearch(params: {
  q?: string;
  sort?: string;
  page?: string;
}): ComponentFixture<Search> {
  const fixture = TestBed.createComponent(Search);
  for (const [name, value] of Object.entries(params)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  return fixture;
}

function buttonWithText(fixture: ComponentFixture<Search>, selector: string, text: string) {
  const buttons: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll(selector));
  const button = buttons.find((b) => b.textContent?.trim() === text);
  if (!button) {
    throw new Error(`No ${selector} button with text "${text}"`);
  }
  return button;
}

describe('Search', () => {
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        // Rendered VideoRows would otherwise fire /api/categories and keep whenStable() waiting.
        {
          provide: CategoriesService,
          useValue: { nameForSlug: (slug: string | undefined) => slug ?? 'Uncategorized' },
        },
      ],
    });
    httpMock = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(TestBed.inject(ViewportScroller), 'scrollToPosition').mockImplementation(() => {});
  });

  afterEach(() => httpMock.verify());

  it('does not request anything for a too-short query', async () => {
    const fixture = createSearch({ q: ' a ' });
    await settle(fixture);

    httpMock.expectNone((r) => r.url === '/api/search/videos');
    expect(fixture.nativeElement.textContent).toContain('at least 2 characters');
  });

  it('requests the first page by relevance and renders the results', async () => {
    const fixture = createSearch({ q: 'kubernetes' });
    // No settle() before flushing: whenStable() waits for the pending request itself.
    const req = httpMock.expectOne((r) => r.url === '/api/search/videos');
    expect(req.request.params.get('q')).toBe('kubernetes');
    expect(req.request.params.get('sort')).toBe('relevance');
    expect(req.request.params.get('page')).toBe('1');
    expect(req.request.params.get('includeAgeRestricted')).toBe('false');
    req.flush(makePage({ items: [makeVideo(1), makeVideo(2)], totalItems: 2 }));
    await settle(fixture);

    expect(fixture.nativeElement.querySelectorAll('app-video-row')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('2 results');
    expect(fixture.nativeElement.querySelector('app-pagination')).toBeNull();
  });

  it('passes sort and page from the URL through and shows the pagination', async () => {
    const fixture = createSearch({ q: 'kubernetes', sort: 'newest', page: '3' });
    // No settle() before flushing: whenStable() waits for the pending request itself.
    const req = httpMock.expectOne((r) => r.url === '/api/search/videos');
    expect(req.request.params.get('sort')).toBe('newest');
    expect(req.request.params.get('page')).toBe('3');
    req.flush(makePage({ page: 3, totalItems: 101, totalPages: 3 }));
    await settle(fixture);

    expect(fixture.nativeElement.querySelector('app-pagination')).not.toBeNull();
  });

  it('changing the page navigates with the new page param', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = createSearch({ q: 'kubernetes' });
    httpMock
      .expectOne((r) => r.url === '/api/search/videos')
      .flush(makePage({ totalItems: 60, totalPages: 2 }));
    await settle(fixture);

    buttonWithText(fixture, '.pagination__page', '2').click();

    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { page: 2 }, queryParamsHandling: 'merge' }),
    );
  });

  it('switching the sort resets the page', async () => {
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = createSearch({ q: 'kubernetes', page: '2' });
    httpMock
      .expectOne((r) => r.url === '/api/search/videos')
      .flush(makePage({ page: 2, totalItems: 60, totalPages: 2 }));
    await settle(fixture);

    buttonWithText(fixture, '.search__sort-option', 'Newest').click();

    expect(navigateSpy).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { sort: 'newest', page: null } }),
    );
  });

  it('shows an empty state when nothing matches', async () => {
    const fixture = createSearch({ q: 'nothing-here' });
    httpMock
      .expectOne((r) => r.url === '/api/search/videos')
      .flush(makePage({ items: [], totalItems: 0, totalPages: 0 }));
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('No matches');
  });
});
