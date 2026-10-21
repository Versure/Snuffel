import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'login',
    title: 'Inloggen · Snuffel',
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    // Always available but not linked anywhere (decision M2, question 2).
    path: 'stijl',
    title: 'Huisstijl · Snuffel',
    loadComponent: () => import('./features/style-guide/style-guide').then((m) => m.StyleGuide),
  },
];
