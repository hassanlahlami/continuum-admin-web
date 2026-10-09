import { Routes } from '@angular/router';
import { AssignPositionPage } from './pages/assign-position.page';

/** Routage de l'Admin Système (MVP : affectation d'une position). */
export const routes: Routes = [
  { path: '', component: AssignPositionPage },
  { path: '**', redirectTo: '' },
];
