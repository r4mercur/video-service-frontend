/// <reference types="@angular/localize" />
import { ViewportScroller } from '@angular/common';
import { httpResource } from '@angular/common/http';
import { Component, computed, DestroyRef, effect, inject, input } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { AdultContentPreferenceService } from '@core/adult-content-preference/adult-content-preference';
import { components } from '@core/api/schema';
import { isApiProblem } from '@core/http/api-problem';
import { Pagination } from '@shared/pagination/pagination';
import { SearchBox } from '@shared/search-box/search-box';
import { VideoRow } from '../overview/video-row/video-row';

type SearchPage = components['schemas']['PageResponseVideoSummaryDto'];
export type SearchSort = 'relevance' | 'newest';

/** Mirrors the backend's lower bound for `q` (CatalogService.search), so it never costs a request. */
const MIN_QUERY_LENGTH = 2;

/**
 * Title search. Unlike the feed this uses numbered pages (backend CLAUDE.md 3.2 exception), and
 * the URL (`?q=&sort=&page=`) is the only source of truth: links are shareable, back works.
 */
@Component({
  selector: 'app-search',
  imports: [SearchBox, VideoRow, Pagination],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class Search {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly scroller = inject(ViewportScroller);
  private readonly title = inject(Title);
  private readonly adultContentPreference = inject(AdultContentPreferenceService);

  // Bound from the query params via withComponentInputBinding.
  readonly q = input<string>();
  readonly sort = input<string>();
  readonly page = input<string>();

  protected readonly query = computed(() => this.q()?.trim() ?? '');
  protected readonly activeSort = computed<SearchSort>(() =>
    this.sort() === 'newest' ? 'newest' : 'relevance',
  );
  protected readonly currentPage = computed(() => {
    const page = Number(this.page());
    return Number.isInteger(page) && page >= 1 ? page : 1;
  });
  protected readonly queryTooShort = computed(() => this.query().length < MIN_QUERY_LENGTH);

  private readonly results = httpResource<SearchPage>(() =>
    this.queryTooShort()
      ? undefined
      : {
          url: '/api/search/videos',
          params: {
            q: this.query(),
            sort: this.activeSort(),
            page: this.currentPage(),
            includeAgeRestricted: this.adultContentPreference.includeAdultContent(),
          },
        },
  );

  // value() throws while the resource is in its error state, hence the hasValue() guard.
  private readonly resultPage = computed(() =>
    this.results.hasValue() ? this.results.value() : undefined,
  );
  protected readonly videos = computed(() => this.resultPage()?.items ?? []);
  protected readonly totalItems = computed(() => this.resultPage()?.totalItems ?? 0);
  protected readonly totalPages = computed(() => this.resultPage()?.totalPages ?? 0);
  protected readonly loading = this.results.isLoading;
  protected readonly error = computed(() => {
    const error = this.results.error();
    return error ? this.describeError(error) : null;
  });

  constructor() {
    const previousTitle = this.title.getTitle();
    inject(DestroyRef).onDestroy(() => this.title.setTitle(previousTitle));

    effect(() => {
      const query = this.query();
      this.title.setTitle(
        query
          ? $localize`${query}:query: – Search – Video Platform`
          : $localize`Search – Video Platform`,
      );
    });
  }

  protected search(query: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: query || null, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected changeSort(sort: SearchSort): void {
    if (sort === this.activeSort()) {
      return;
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { sort: sort === 'relevance' ? null : sort, page: null },
      queryParamsHandling: 'merge',
    });
  }

  protected async goToPage(page: number): Promise<void> {
    await this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: page === 1 ? null : page },
      queryParamsHandling: 'merge',
    });
    // The pagination sits below 50 rows - without this the new page starts scrolled to its end.
    this.scroller.scrollToPosition([0, 0]);
  }

  private describeError(error: unknown): string {
    if (isApiProblem(error)) {
      return error.detail ?? error.title;
    }
    return $localize`Search failed. Please try again.`;
  }
}
