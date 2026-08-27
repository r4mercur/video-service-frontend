import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { isApiProblem } from './api-problem';

/**
 * On an application/problem+json response, passes the typed ApiProblem through directly,
 * instead of every caller having to reach into HttpErrorResponse.error themselves.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) =>
  next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && isApiProblem(error.error)) {
        return throwError(() => error.error);
      }
      return throwError(() => error);
    }),
  );
