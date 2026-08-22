import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

/**
 * Einziger sanktionierter Zugriffspunkt auf Browser-Storage (CLAUDE.md Abschnitt 6.1).
 * Restliche App-Code darf localStorage/sessionStorage nicht direkt anfassen.
 */
@Injectable({ providedIn: 'root' })
export class StorageService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  getItem(key: string): string | null {
    if (!this.isBrowser) {
      return null;
    }
    // eslint-disable-next-line no-restricted-globals -- StorageService ist die sanktionierte Ausnahme.
    return localStorage.getItem(key);
  }

  setItem(key: string, value: string): void {
    if (!this.isBrowser) {
      return;
    }
    // eslint-disable-next-line no-restricted-globals -- StorageService ist die sanktionierte Ausnahme.
    localStorage.setItem(key, value);
  }

  removeItem(key: string): void {
    if (!this.isBrowser) {
      return;
    }
    // eslint-disable-next-line no-restricted-globals -- StorageService ist die sanktionierte Ausnahme.
    localStorage.removeItem(key);
  }
}
