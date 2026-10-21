import { Routes } from '@angular/router';
import { AssignPositionPage } from './pages/assign-position.page';
import { AuditTrailPage } from './pages/audit-trail.page';

/** Routage de l'Admin Système (affectation d'une position ; piste d'audit des opérations). */
export const routes: Routes = [
  { path: '', component: AssignPositionPage },
  { path: 'audit-trail', component: AuditTrailPage },
  { path: '**', redirectTo: '' },
];
