import { Routes } from '@angular/router';
import { authGuard } from '@core/auth/auth-guard';

export const routes: Routes = [
  {
    path: 'auth',
    loadChildren: () => import('@features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: '',
    loadComponent: () => import('./layout/app-shell/app-shell').then((m) => m.AppShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'catalog' },
      {
        path: 'catalog',
        loadChildren: () =>
          import('@features/catalog/catalog.routes').then((m) => m.CATALOG_ROUTES),
      },
      {
        path: 'watch',
        loadChildren: () => import('@features/watch/watch.routes').then((m) => m.WATCH_ROUTES),
      },
      {
        path: 'upload',
        canActivate: [authGuard],
        loadComponent: () => import('@features/upload/upload').then((m) => m.Upload),
      },
      {
        path: 'studio',
        canActivate: [authGuard],
        loadComponent: () => import('@features/studio/studio').then((m) => m.Studio),
      },
    ],
  },
];
