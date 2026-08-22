import { Routes } from '@angular/router';

export const WATCH_ROUTES: Routes = [
  { path: ':slug', loadComponent: () => import('./detail/detail').then((m) => m.VideoDetail) },
];
