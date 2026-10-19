import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    // Always available but not linked anywhere (decision M2, question 2).
    path: 'stijl',
    title: 'Huisstijl · Snuffel',
    loadComponent: () => import('./features/style-guide/style-guide').then((m) => m.StyleGuide),
  },
];
