import { computed, inject, Injectable, signal } from '@angular/core';
import { StorageService } from '@core/storage/storage';

const STORAGE_KEY = 'adult-content-preference';

/**
 * Whether the visitor wants the age-restricted ("adult") category included in catalog listings
 * (`includeAgeRestricted` query param, see `CatalogApi`/backend `VideoRepository`). Backed by a
 * single localStorage value: absent means "not answered yet" (the dialog should show), `'true'`/
 * `'false'` is the visitor's actual choice — not a site-wide access gate, just a discovery
 * filter, so there is no "decline and leave" path here.
 */
@Injectable({ providedIn: 'root' })
export class AdultContentPreferenceService {
  private readonly storage = inject(StorageService);

  private readonly raw = signal(this.storage.getItem(STORAGE_KEY));

  readonly answered = computed(() => this.raw() !== null);
  readonly includeAdultContent = computed(() => this.raw() === 'true');

  setPreference(includeAdultContent: boolean): void {
    const value = includeAdultContent ? 'true' : 'false';
    this.storage.setItem(STORAGE_KEY, value);
    this.raw.set(value);
  }
}
