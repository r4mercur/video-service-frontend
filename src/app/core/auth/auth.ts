import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { components } from '@core/api/schema';
import { firstValueFrom } from 'rxjs';

type AccessTokenResponse = components['schemas']['AccessTokenResponse'];
type LoginRequest = components['schemas']['LoginRequest'];
type RegisterRequest = components['schemas']['RegisterRequest'];
export type UserResponse = components['schemas']['UserResponse'];

function requireAccessToken(response: AccessTokenResponse): string {
  if (!response.accessToken) {
    throw new Error('Auth-Antwort enthielt keinen accessToken.');
  }
  return response.accessToken;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly accessToken = signal<string | null>(null);
  private readonly user = signal<UserResponse | null>(null);
  private refreshInFlight: Promise<string> | null = null;

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.accessToken() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  /** Token nur fürs HTTP-Interceptor-Paar bestimmt, kein Konsum durch Feature-Code. */
  getAccessToken(): string | null {
    return this.accessToken();
  }

  async login(identifier: string, password: string): Promise<void> {
    const body: LoginRequest = { identifier, password };
    const response = await firstValueFrom(
      this.http.post<AccessTokenResponse>('/api/auth/login', body),
    );
    this.accessToken.set(requireAccessToken(response));
    await this.loadCurrentUser();
  }

  async register(email: string, username: string, password: string): Promise<void> {
    const body: RegisterRequest = { email, username, password };
    await firstValueFrom(this.http.post<UserResponse>('/api/auth/register', body));
    // Registrierung liefert noch keinen Access-Token — direkt im Anschluss einloggen.
    await this.login(username, password);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.clearSession();
    }
  }

  /** Wird beim App-Start aufgerufen: versucht, eine Session aus dem Refresh-Cookie wiederherzustellen. */
  async restoreSession(): Promise<void> {
    try {
      await this.refreshAccessToken();
      await this.loadCurrentUser();
    } catch {
      this.clearSession();
    }
  }

  /** Dedupliziert parallele Refresh-Versuche (z. B. mehrere 401s gleichzeitig). */
  refreshAccessToken(): Promise<string> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh().finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private async performRefresh(): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<AccessTokenResponse>('/api/auth/refresh', {}),
    );
    const token = requireAccessToken(response);
    this.accessToken.set(token);
    return token;
  }

  private async loadCurrentUser(): Promise<void> {
    this.user.set(await firstValueFrom(this.http.get<UserResponse>('/api/me')));
  }

  private clearSession(): void {
    this.accessToken.set(null);
    this.user.set(null);
  }
}
