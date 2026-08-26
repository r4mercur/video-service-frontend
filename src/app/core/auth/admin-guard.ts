import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth';

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isAdmin()) {
    return true;
  }

  const router = inject(Router);
  return router.createUrlTree(['/catalog']);
};
