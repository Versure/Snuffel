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
    // The page of one child; the component sets the title with the name of the child.
    path: 'ouder/:childId',
    title: 'Ouderoverzicht · Snuffel',
    canActivate: [authGuard, roleGuard('parent')],
    loadComponent: () => import('./features/parent/child/child').then((m) => m.ChildOverview),
  },
  {
    // The overview of a course; Angular matches on the number of segments, so the lesson route
    // below is never taken for this one.
    path: 'leren/:courseId',
    title: 'Leertraject · Snuffel',
    canActivate: [authGuard],
    loadComponent: () => import('./features/course/course').then((m) => m.Course),
  },
  {
    // A lesson, for a child and a parent alike (plan M7, question 8).
    path: 'leren/:courseId/:lessonId',
    title: 'Les · Snuffel',
    canActivate: [authGuard],
    loadComponent: () => import('./features/lesson/lesson').then((m) => m.Lesson),
  },
  {
    // Always available but not linked anywhere (decision M2, question 2); no login needed.
    path: 'stijl',
    title: 'Huisstijl · Snuffel',
    loadComponent: () => import('./features/style-guide/style-guide').then((m) => m.StyleGuide),
  },
];
