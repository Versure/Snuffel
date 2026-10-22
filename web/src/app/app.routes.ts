import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth/auth.guard';
import { roleGuard } from './core/auth/role.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'login',
    title: 'Inloggen · Snuffel',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/login/login').then((m) => m.Login),
  },
  {
    path: 'ouder',
    title: 'Ouderoverzicht · Snuffel',
    canActivate: [authGuard, roleGuard('parent')],
    loadComponent: () => import('./features/parent/parent').then((m) => m.Parent),
  },
  {
    // Always available but not linked anywhere (decision M2, question 2); no login needed.
    path: 'stijl',
    title: 'Huisstijl · Snuffel',
    loadComponent: () => import('./features/style-guide/style-guide').then((m) => m.StyleGuide),
  },
];
