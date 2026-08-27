import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

/**
 * The only sanctioned access point for browser storage (CLAUDE.md section 6.1).
 * The rest of the app code must not touch localStorage/sessionStorage directly.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  getItem(key: string): string | null {
    if (!this.isBrowser) {
      return null;
    }
    // eslint-disable-next-line no-restricted-globals -- StorageService is the sanctioned exception.
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (!this.isBrowser) {
      return;
    }
    // eslint-disable-next-line no-restricted-globals -- StorageService is the sanctioned exception.
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    if (!this.isBrowser) {
      return;
    }
    // eslint-disable-next-line no-restricted-globals -- StorageService is the sanctioned exception.
    localStorage.removeItem(key);
  }
}
