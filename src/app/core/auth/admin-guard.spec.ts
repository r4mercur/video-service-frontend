import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { adminGuard } from './admin-guard';
import { AuthService } from './auth';

describe('adminGuard', () => {
  function configure(isAdmin: boolean): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { isAdmin: () => isAdmin } },
      ],
    });
  }

  function run() {
    return TestBed.runInInjectionContext(() =>
      adminGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
  }

  it('lets admins through', () => {
    configure(true);
    expect(run()).toBe(true);
  });

  it('redirects non-admins to /catalog', () => {
    configure(false);
    const result = run();
    const router = TestBed.inject(Router);
    expect(router.serializeUrl(result as UrlTree)).toBe('/catalog');
  });
});
