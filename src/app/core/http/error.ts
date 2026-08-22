import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { isApiProblem } from './api-problem';

/**
 * Reicht bei einer application/problem+json-Antwort direkt das typisierte ApiProblem durch,
 * statt dass jeder Aufrufer selbst in HttpErrorResponse.error greifen muss.
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
