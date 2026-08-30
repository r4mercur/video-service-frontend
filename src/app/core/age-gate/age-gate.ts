import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
import { StorageService } from '@core/storage/storage';

const STORAGE_KEY = 'age-gate-confirmed';
const DECLINE_REDIRECT_URL = 'https://www.google.com';

/**
 * Site-wide 18+ disclaimer gate (self-declaration only, no real age verification —
 * see CLAUDE.md section 12 "Rebrand-Kandidat"-adjacent decision from 2026-08-30).
 * `App` keeps the router outlet unmounted until `confirmed()` is true.
 */
@Injectable({ providedIn: 'root' })
export class AgeGateService {
  private readonly storage = inject(StorageService);
  private readonly document = inject(DOCUMENT);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly confirmed = signal(this.storage.getItem(STORAGE_KEY) === 'true');

  confirm(): void {
    this.storage.setItem(STORAGE_KEY, 'true');
    this.confirmed.set(true);
  }

  decline(): void {
    if (!this.isBrowser) {
      return;
    }
    this.document.defaultView?.location.assign(DECLINE_REDIRECT_URL);
  }
}
