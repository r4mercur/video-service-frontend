import { Injectable, signal } from '@angular/core';

export interface AppConfig {
  /** Leerstring = same-origin (Dev-Proxy bzw. Prod-Reverse-Proxy vor die API). */
  apiBaseUrl: string;
}

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private readonly loaded = signal<AppConfig | null>(null);

  // Bewusst per fetch() statt HttpClient geladen: der apiBaseUrl-Interceptor braucht den
  // geladenen Config-Wert, ein Zirkelbezug über HttpClient wäre hier falsch.
  async load(): Promise<void> {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error(`Runtime-Config konnte nicht geladen werden (HTTP ${response.status}).`);
    }
    this.loaded.set((await response.json()) as AppConfig);
  }

  get apiBaseUrl(): string {
    const config = this.loaded();
    if (!config) {
      throw new Error('ConfigService.apiBaseUrl wurde vor load() aufgerufen.');
    }
    return config.apiBaseUrl;
  }
}
