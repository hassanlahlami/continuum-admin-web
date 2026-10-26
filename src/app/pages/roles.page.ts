import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ChangeResult, RoleFeatureMatrix, RolesService } from '../../../libs/api-clients/admin-iam';

/**
 * Rôles et matrice des fonctionnalités (ADM-09, §2.1) — vue en lecture : rôles en colonnes, fonctionnalités
 * en lignes, lues via `getRoleFeatureMatrix` (client généré, D32). Seuls les libellés s'affichent. Les
 * fonctionnalités sensibles et les conflits SoD détectés par le serveur sont signalés ; le front n'enforce
 * ni ne calcule rien (périmètre `admin.role.read` appliqué côté serveur).
 */
@Component({
  selector: 'ct-roles',
  standalone: true,
  imports: [MatButtonModule, MatCheckboxModule, MatCardModule, MatIconModule, MatProgressBarModule],
  template: `
    <section>
      <header class="page-head"><h1>Rôles et fonctionnalités</h1></header>
      <p class="page-sub">Matrice des fonctionnalités accordées à chaque rôle. Les fonctionnalités sensibles et les conflits de séparation des tâches sont signalés.</p>

      @if (message(); as msg) { <p class="ok" role="status" data-cy="roles-message">{{ msg }}</p> }
      @if (error(); as code) { <p class="err" role="alert" data-cy="roles-error">{{ errorHint(code) }}</p> }

      @if (loading()) { <mat-progress-bar mode="indeterminate" data-cy="roles-loading"></mat-progress-bar> }

      @if (matrix(); as m) {
        @for (w of m.sodWarnings ?? []; track $index) {
          <div class="sod" role="alert" data-cy="roles-sod-warning">
            <mat-icon aria-hidden="true">warning</mat-icon>
            <span><strong>{{ roleLabel(w.roleId) }}</strong> — {{ w.message }}</span>
          </div>
        }
        @if (updateAction()) {
          <div class="actions">
            @if (!editing()) {
              <button mat-stroked-button type="button" data-cy="roles-edit" (click)="startEdit()">{{ updateAction()?.label }}</button>
            } @else {
              <button mat-flat-button type="button" data-cy="roles-save" [disabled]="!dirty() || saving()" (click)="save()">Enregistrer ({{ changes().length }})</button>
              <button mat-button type="button" data-cy="roles-cancel" (click)="cancel()">Annuler</button>
            }
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
                        @if (editing() && updateAction()) {
                          <mat-checkbox [checked]="isGranted(r.id, f.code)" (change)="toggle(r.id, f.code, $event.checked)" [attr.data-cy]="'cell-' + r.code + '-' + f.code" [attr.aria-label]="r.label.fr + ' — ' + f.label"></mat-checkbox>
                        } @else if (granted().has(r.id + '|' + f.code)) {
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
      .actions { margin-bottom: var(--ct-space-2); display: flex; gap: var(--ct-space-2); }
      .ok { color: var(--ct-green-600); }
      .err { color: var(--ct-red-700); }
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

  /** Action de modification décidée par le serveur (`availableActions` de la matrice) : absente → lecture seule. */
  readonly updateAction = computed(() => this.matrix()?.availableActions?.find((a) => a.code === 'update-matrix') ?? null);
  readonly editing = signal(false);
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<number | null>(null);
  /** Brouillon différentiel : clé `roleId|featureCode` → état souhaité. */
  private readonly draft = signal<Map<string, boolean>>(new Map());
  readonly changes = computed(() =>
    [...this.draft()].map(([k, granted]) => {
      const [roleId, featureCode] = k.split('|');
      return { roleId, featureCode, granted };
    }),
  );
  readonly dirty = computed(() => this.changes().length > 0);

  ngOnInit(): void {
    this.load();
  }

  isGranted(roleId: string, code: string): boolean {
    const k = roleId + '|' + code;
    return this.draft().get(k) ?? this.granted().has(k);
  }

  toggle(roleId: string, code: string, checked: boolean): void {
    const k = roleId + '|' + code;
    const next = new Map(this.draft());
    if (this.granted().has(k) === checked) next.delete(k);
    else next.set(k, checked);
    this.draft.set(next);
  }

  startEdit(): void {
    if (!this.updateAction()) return;
    this.message.set(null);
    this.error.set(null);
    this.editing.set(true);
  }

  cancel(): void {
    this.draft.set(new Map());
    this.editing.set(false);
  }

  errorHint(code: number): string {
    if (code === 403) return 'Modification refusée par le serveur (droit insuffisant ou règle de protection).';
    if (code === 409) return 'La matrice a été modifiée entre-temps : elle a été rechargée, refaites votre modification.';
    return 'Modification non acceptée par le serveur.';
  }

  save(): void {
    const m = this.matrix();
    if (!m || !this.updateAction() || !this.dirty()) return;
    this.saving.set(true);
    this.error.set(null);
    this.message.set(null);
    this.rolesSvc.updateRoleFeatureMatrix({ version: m.version, changes: this.changes() }).subscribe({
      next: (r) => {
        this.saving.set(false);
        this.cancel();
        this.load();
        this.message.set(r.state === ChangeResult.StateEnum.PendingApproval
          ? 'Modification soumise à double validation (fonctionnalité sensible).'
          : 'Matrice enregistrée.');
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(e.status);
        if (e.status === 409) { this.cancel(); this.load(); }
      },
    });
  }

  private load(): void {
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
