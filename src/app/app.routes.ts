import { Route } from '@angular/router';
import { DashboardComponent } from './components/dashboard/dashboard.component';

export const appRoutes: Route[] = [
  { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: DashboardComponent },
  { path: 'features', loadComponent: () => import('./app').then(m => m.App) },
  { 
    path: 'templates', 
    loadComponent: () => import('./components/templates/templates.component').then(m => m.TemplatesComponent) 
  },
  { 
    path: 'analytics', 
    loadComponent: () => import('./components/analytics/analytics.component').then(m => m.AnalyticsComponent) 
  },
];
