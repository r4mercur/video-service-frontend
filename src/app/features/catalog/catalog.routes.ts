import { Routes } from '@angular/router';

export const CATALOG_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./overview/overview').then((m) => m.Overview) },
];
