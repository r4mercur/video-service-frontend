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
    throw new Error('Auth response did not contain an accessToken.');
  }
  return response.accessToken;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly accessToken = signal<string | null>(null);
  private readonly user = signal<UserResponse | null>(null);
  private refreshInFlight: Promise<string> | null = null;
  private proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.accessToken() !== null);
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  /** Token is only for the HTTP interceptor pair — not meant to be consumed by feature code. */
  getAccessToken(): string | null {
    return this.accessToken();
  }

  async login(identifier: string, password: string): Promise<void> {
    const body: LoginRequest = { identifier, password };
    const response = await firstValueFrom(
      this.http.post<AccessTokenResponse>('/api/auth/login', body),
    );
    this.applyTokenResponse(response);
    await this.loadCurrentUser();
  }

  async register(email: string, username: string, password: string): Promise<void> {
    const body: RegisterRequest = { email, username, password };
    await firstValueFrom(this.http.post<UserResponse>('/api/auth/register', body));
    // Registration doesn't return an access token yet — log in right after.
    await this.login(username, password);
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.http.post('/api/auth/logout', {}));
    } finally {
      this.clearSession();
    }
  }

  /** Called on app start: tries to restore a session from the refresh cookie. */
  async restoreSession(): Promise<void> {
    try {
      await this.refreshAccessToken();
      await this.loadCurrentUser();
    } catch {
      this.clearSession();
    }
  }

  /**
   * Deduplicates concurrent refresh attempts (e.g. several 401s at once). A refresh that
   * genuinely fails (expired/revoked token, ...) clears the session right here, once - so every
   * caller (the proactive timer below, authRefreshInterceptor's reactive retry, restoreSession)
   * ends up in the same correctly logged-out state instead of isAuthenticated() staying stuck
   * `true` for a token that will never work again.
   */
  refreshAccessToken(): Promise<string> {
    if (!this.refreshInFlight) {
      this.refreshInFlight = this.performRefresh()
        .catch((error: unknown) => {
          this.clearSession();
          throw error;
        })
        .finally(() => {
          this.refreshInFlight = null;
        });
    }
    return this.refreshInFlight;
  }

  private async performRefresh(): Promise<string> {
    const response = await firstValueFrom(
      this.http.post<AccessTokenResponse>('/api/auth/refresh', {}),
    );
    return this.applyTokenResponse(response);
  }

  private async loadCurrentUser(): Promise<void> {
    this.user.set(await firstValueFrom(this.http.get<UserResponse>('/api/me')));
  }

  private applyTokenResponse(response: AccessTokenResponse): string {
    const token = requireAccessToken(response);
    this.accessToken.set(token);
    this.scheduleProactiveRefresh(response.expiresInSeconds ?? null);
    return token;
  }

  /**
   * Refreshes a bit before the access token actually expires, so a normal request never has to
   * hit a 401-then-retry round trip first - the 15 min access-token TTL stays invisible during
   * regular use. Rescheduled on every successful token response (login/refresh/restoreSession);
   * stopped on logout or a failed refresh (via clearSession).
   */
  private scheduleProactiveRefresh(expiresInSeconds: number | null): void {
    this.clearProactiveRefresh();
    if (expiresInSeconds == null) {
      return;
    }
    const delayMs = Math.max(expiresInSeconds * 0.8, 5) * 1000;
    this.proactiveRefreshTimer = setTimeout(() => {
      this.refreshAccessToken().catch(() => {
        // Swallowed - refreshAccessToken() already cleared the session above on failure, and
        // there's no pending request here to fail loudly to.
      });
    }, delayMs);
  }

  private clearProactiveRefresh(): void {
    if (this.proactiveRefreshTimer !== null) {
      clearTimeout(this.proactiveRefreshTimer);
      this.proactiveRefreshTimer = null;
    }
  }

  private clearSession(): void {
    this.clearProactiveRefresh();
    this.accessToken.set(null);
    this.user.set(null);
  }
}
