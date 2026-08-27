import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@core/auth/auth';
import { catchError, from, switchMap, throwError } from 'rxjs';

/**
 * On a 401 for an authenticated request: try once to renew the access token via the
 * refresh cookie, then retry the request with the new token.
 * Auth endpoints themselves are excluded to avoid refresh loops.
 */
export const authRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/api/auth/')) {
    return next(req);
  }

  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (
        !(error instanceof HttpErrorResponse) ||
        error.status !== 401 ||
        !auth.isAuthenticated()
      ) {
        return throwError(() => error);
      }

      return from(auth.refreshAccessToken()).pipe(
        switchMap((token) => next(req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }))),
        catchError(() => throwError(() => error)),
      );
    }),
  );
};
