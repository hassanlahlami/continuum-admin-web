import { Routes } from '@angular/router';
import { AssignPositionPage } from './pages/assign-position.page';
import { AuditTrailPage } from './pages/audit-trail.page';
import { AuthzSimulatorPage } from './pages/authz-simulator.page';
import { CachesPage } from './pages/caches.page';
import { ConnectorsPage } from './pages/connectors.page';
import { LogsPage } from './pages/logs.page';
import { OverviewPage } from './pages/overview.page';
import { PendingChangesPage } from './pages/pending-changes.page';
import { PositionEditorPage } from './pages/position-editor.page';
import { PositionsPage } from './pages/positions.page';
import { RolesPage } from './pages/roles.page';
import { SodRulesPage } from './pages/sod-rules.page';
import { UserCreatePage } from './pages/user-create.page';
import { UserDetailPage } from './pages/user-detail.page';
import { UsersPage } from './pages/users.page';

/** Routage de l'Admin Système : utilisateurs (annuaire, profil, création), affectations, piste d'audit. */
export const routes: Routes = [
  { path: '', component: OverviewPage },
  { path: 'users', component: UsersPage },
  { path: 'users/new', component: UserCreatePage },
  { path: 'users/:userId', component: UserDetailPage },
  { path: 'positions', component: PositionsPage },
  { path: 'positions/:positionId', component: PositionEditorPage },
  { path: 'roles', component: RolesPage },
  { path: 'pending', component: PendingChangesPage },
  { path: 'sod-rules', component: SodRulesPage },
  { path: 'assignments', component: AssignPositionPage },
  { path: 'audit-trail', component: AuditTrailPage },
  { path: 'connectors', component: ConnectorsPage },
  { path: 'caches', component: CachesPage },
  { path: 'logs', component: LogsPage },
  { path: 'authz-simulator', component: AuthzSimulatorPage },
  { path: '**', redirectTo: '' },
];
