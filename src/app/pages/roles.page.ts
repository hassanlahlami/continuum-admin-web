import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RoleFeatureMatrix, RolesService } from '../../../libs/api-clients/admin-iam';

/**
 * Rôles et matrice des fonctionnalités (ADM-09, §2.1) — vue en lecture : rôles en colonnes, fonctionnalités
 * en lignes, lues via `getRoleFeatureMatrix` (client généré, D32). Seuls les libellés s'affichent. Les
 * fonctionnalités sensibles et les conflits SoD détectés par le serveur sont signalés ; le front n'enforce
 * ni ne calcule rien (périmètre `admin.role.read` appliqué côté serveur).
 */
@Component({
  selector: 'ct-roles',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatProgressBarModule],
  template: `
    <section>
      <header class="page-head"><h1>Rôles et fonctionnalités</h1></header>
      <p class="page-sub">Matrice des fonctionnalités accordées à chaque rôle. Les fonctionnalités sensibles et les conflits de séparation des tâches sont signalés.</p>

      @if (loading()) { <mat-progress-bar mode="indeterminate" data-cy="roles-loading"></mat-progress-bar> }

      @if (matrix(); as m) {
        @for (w of m.sodWarnings ?? []; track $index) {
          <div class="sod" role="alert" data-cy="roles-sod-warning">
            <mat-icon aria-hidden="true">warning</mat-icon>
            <span><strong>{{ roleLabel(w.roleId) }}</strong> — {{ w.message }}</span>
          </div>
        }
        <mat-card appearance="outlined">
          <mat-card-content class="scroll">
            <table data-cy="roles-matrix">
              <thead>
                <tr>
                  <th scope="col">Fonctionnalité</th>
                  @for (r of m.roles; track r.id) {
                    <th scope="col" data-cy="role-col">
                      {{ r.label.fr }}
                      @if (r.fromPack) { <span class="pack">Pack</span> }
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (f of m.features; track f.code) {
                  <tr data-cy="feature-row">
                    <th scope="row">
                      <span class="module">{{ f.module }}</span> {{ f.label }}
                      @if (f.sensitive) { <span class="sensitive" data-cy="feature-sensitive">Sensible</span> }
                    </th>
                    @for (r of m.roles; track r.id) {
                      <td>
                        @if (granted().has(r.id + '|' + f.code)) {
                          <mat-icon class="yes" data-cy="grant-yes" aria-label="Accordée">check</mat-icon>
                        } @else {
                          <span class="no" aria-label="Non accordée">—</span>
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </mat-card-content>
        </mat-card>
      } @else if (!loading()) {
        <p class="muted" data-cy="roles-empty">Aucun rôle.</p>
      }
    </section>
  `,
  styles: [
    `
      .page-sub { color: var(--ct-color-muted); margin-top: 0; max-width: 72ch; }
      .scroll { overflow-x: auto; }
      table { border-collapse: collapse; width: 100%; }
      th, td { padding: var(--ct-space-2) var(--ct-space-3); border-bottom: 1px solid var(--ct-color-border); text-align: center; }
      thead th { background: var(--ct-color-surface); }
      tbody th { text-align: left; font-weight: 400; }
      .module { color: var(--ct-color-muted); font-size: 0.75rem; margin-right: var(--ct-space-2); }
      .pack { margin-left: var(--ct-space-2); font-size: 0.75rem; color: var(--ct-color-muted); border: 1px solid var(--ct-color-border); border-radius: 999px; padding: 0 var(--ct-space-2); }
      .sensitive { margin-left: var(--ct-space-2); font-size: 0.75rem; background: var(--ct-amber-50); color: var(--ct-amber-700); border-radius: 999px; padding: 0 var(--ct-space-2); }
      .sod { display: flex; align-items: center; gap: var(--ct-space-2); background: var(--ct-red-50); color: var(--ct-red-700); padding: var(--ct-space-2) var(--ct-space-3); margin-bottom: var(--ct-space-2); }
      .yes { color: var(--ct-green-600); }
      .no, .muted { color: var(--ct-color-muted); }
    `,
  ],
})
export class RolesPage implements OnInit {
  private readonly rolesSvc = inject(RolesService);

  readonly matrix = signal<RoleFeatureMatrix | null>(null);
  readonly loading = signal(false);
  readonly granted = computed(
    () => new Set((this.matrix()?.grants ?? []).map((g) => g.roleId + '|' + g.featureCode)),
  );

  ngOnInit(): void {
    this.loading.set(true);
    this.rolesSvc.getRoleFeatureMatrix().subscribe({
      next: (m) => {
        this.matrix.set(m.roles.length ? m : null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  roleLabel(id?: string): string {
    return this.matrix()?.roles.find((r) => r.id === id)?.label.fr ?? '';
  }
}
