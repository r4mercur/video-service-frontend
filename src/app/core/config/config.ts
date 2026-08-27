import { Injectable, signal } from '@angular/core';

export interface AppConfig {
  /** Empty string = same-origin (dev proxy or prod reverse proxy in front of the API). */
  apiBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly loaded = signal<AppConfig | null>(null);

  // Deliberately loaded via fetch() instead of HttpClient: the apiBaseUrl interceptor needs
  // the loaded config value, so a circular dependency through HttpClient would be wrong here.
  async load(): Promise<void> {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error(`Could not load runtime config (HTTP ${response.status}).`);
    }
    this.loaded.set((await response.json()) as AppConfig);
  }

  get apiBaseUrl(): string {
    const config = this.loaded();
    if (!config) {
      throw new Error('ConfigService.apiBaseUrl was called before load().');
    }
    return config.apiBaseUrl;
  }
}
