import { Routes } from '@angular/router';
import { AssignPositionPage } from './pages/assign-position.page';
import { AuditTrailPage } from './pages/audit-trail.page';
import { ConnectorsPage } from './pages/connectors.page';
import { PositionsPage } from './pages/positions.page';
import { UserCreatePage } from './pages/user-create.page';
import { UserDetailPage } from './pages/user-detail.page';
import { UsersPage } from './pages/users.page';

/** Routage de l'Admin Système : utilisateurs (annuaire, profil, création), affectations, piste d'audit. */
export const routes: Routes = [
  { path: '', component: UsersPage },
  { path: 'users/new', component: UserCreatePage },
  { path: 'users/:userId', component: UserDetailPage },
  { path: 'positions', component: PositionsPage },
  { path: 'assignments', component: AssignPositionPage },
  { path: 'audit-trail', component: AuditTrailPage },
  { path: 'connectors', component: ConnectorsPage },
  { path: '**', redirectTo: '' },
];
