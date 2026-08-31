import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthService } from './auth';

describe('AuthService', () => {
  let auth: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  async function login(expiresInSeconds: number): Promise<void> {
    const loginPromise = auth.login('user@example.com', 'password123');
    httpMock.expectOne('/api/auth/login').flush({ accessToken: 'token-1', expiresInSeconds });
    // login() awaits the login POST via firstValueFrom before issuing /api/me - that resumption
    // happens as a microtask, not synchronously after flush().
    await vi.advanceTimersByTimeAsync(0);
    httpMock.expectOne('/api/me').flush({
      id: 'u1',
      email: 'user@example.com',
      username: 'user',
      role: 'USER',
      status: 'ACTIVE',
    });
    await loginPromise;
  }

  it('proactively refreshes the access token before it actually expires', async () => {
    await login(900); // 15 min access-token TTL, matches the backend default

    await vi.advanceTimersByTimeAsync(900 * 0.8 * 1000);

    const refreshReq = httpMock.expectOne('/api/auth/refresh');
    refreshReq.flush({ accessToken: 'token-2', expiresInSeconds: 900 });
    await vi.advanceTimersByTimeAsync(0);

    expect(auth.getAccessToken()).toBe('token-2');
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('clears the session when a refresh genuinely fails', async () => {
    await login(900);

    const refreshPromise = auth.refreshAccessToken();
    httpMock
      .expectOne('/api/auth/refresh')
      .flush({ title: 'Unauthorized', status: 401 }, { status: 401, statusText: 'Unauthorized' });

    await expect(refreshPromise).rejects.toBeTruthy();
    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.currentUser()).toBeNull();
  });

  it('does not schedule another proactive refresh after a failed refresh', async () => {
    await login(900);

    const refreshPromise = auth.refreshAccessToken();
    httpMock
      .expectOne('/api/auth/refresh')
      .flush({ title: 'Unauthorized', status: 401 }, { status: 401, statusText: 'Unauthorized' });
    await expect(refreshPromise).rejects.toBeTruthy();

    // The timer scheduled by the original login() must have been cleared by clearSession() -
    // otherwise a stray refresh call would fire later for a session that's already gone.
    await vi.advanceTimersByTimeAsync(900 * 1000);
    httpMock.expectNone('/api/auth/refresh');
  });
});
