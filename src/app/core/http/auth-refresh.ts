import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '@core/auth/auth';
import { catchError, from, switchMap, throwError } from 'rxjs';

/**
 * Bei 401 auf einem authentifizierten Request: einmal versuchen, den Access-Token per
 * Refresh-Cookie zu erneuern, und den Request mit dem neuen Token wiederholen.
 * Auth-Endpunkte selbst sind ausgenommen, um Refresh-Loops zu vermeiden.
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
