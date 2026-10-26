import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Position, PositionInput, PositionsService, RolesService } from '../../../libs/api-clients/admin-iam';
import { POSITION_SCOPE_LABELS } from '../iam.labels';

/**
 * Éditeur de position (ADM-08, §2.1) : route `/positions/:positionId`. Lit la position via `getPosition`,
 * enregistre via `updatePosition` (libellés FR/AR/EN, rang, portée, titulaires maximum, rôles), et
 * désactive / réactive via `performPositionAction`. Les fonctionnalités résultantes sont celles renvoyées
 * par le serveur ; un changement qui porte une fonctionnalité sensible est en attente de double validation
 * (`pendingChange`). Le front n'enforce aucune règle : il affiche la décision (403 si la position est occupée
 * par l'administrateur, §2.1.8). Servi par les mocks MSW (sans backend ni Keycloak). Sélecteurs `data-cy` (D36).
 */
@Component({
  selector: 'ct-position-editor',
  standalone: true,
  imports: [
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
  ],
  template: `
    <section>
      <a mat-button routerLink="/positions"><mat-icon>arrow_back</mat-icon> Positions</a>

      @if (position(); as p) {
        <header class="page-head">
          <h1>{{ p.label.fr }}</h1>
          <mat-chip-set>
            <mat-chip disableRipple data-cy="position-state" [attr.data-state]="p.active ? 'ACTIVE' : 'INACTIVE'">{{ p.active ? 'Active' : 'Désactivée' }}</mat-chip>
            @if (p.pendingChange) { <mat-chip disableRipple data-state="PENDING" data-cy="position-pending">Modification en attente</mat-chip> }
          </mat-chip-set>
        </header>

        <mat-card appearance="outlined" class="block">
          <mat-card-content>
            <form class="form" (submit)="$event.preventDefault(); save()">
              <div class="grid">
                <mat-form-field appearance="outline">
                  <mat-label>Libellé (FR)</mat-label>
                  <input matInput name="labelFr" [(ngModel)]="form.fr" required data-cy="position-label-fr" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Libellé (AR)</mat-label>
                  <input matInput name="labelAr" [(ngModel)]="form.ar" dir="rtl" data-cy="position-label-ar" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Libellé (EN)</mat-label>
                  <input matInput name="labelEn" [(ngModel)]="form.en" data-cy="position-label-en" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Rang</mat-label>
                  <input matInput type="number" name="rank" min="1" max="99" [(ngModel)]="form.rank" data-cy="position-rank-input" />
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Portée</mat-label>
                  <mat-select name="scope" [(ngModel)]="form.scope" data-cy="position-scope">
                    @for (s of scopes; track s) {
                      <mat-option [value]="s">{{ scopeLabel(s) }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
                <mat-form-field appearance="outline">
                  <mat-label>Titulaires maximum par unité</mat-label>
                  <input matInput type="number" name="maxHolders" min="1" [(ngModel)]="form.maxHoldersPerUnit" data-cy="position-max-holders" />
                </mat-form-field>
                <mat-form-field appearance="outline" class="wide">
                  <mat-label>Rôles</mat-label>
                  <mat-select name="roles" multiple [(ngModel)]="form.roleIds" data-cy="position-roles">
                    @for (r of roleOptions(); track r.id) {
                      <mat-option [value]="r.id" [attr.data-role-code]="r.code">{{ r.label.fr }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>
              </div>

              <div class="actions">
                <button mat-flat-button type="submit" data-cy="position-save">Enregistrer</button>
              </div>
            </form>

            @if (ok(); as msg) {
              <p class="ok" role="status" data-cy="position-ok">✓ {{ msg }}</p>
            }
            @if (error(); as code) {
              <p class="err" role="alert" data-cy="position-error">✗ Refus (HTTP {{ code }}) : {{ errorHint(code) }}</p>
            }
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="block">
          <mat-card-header><mat-card-title>Fonctionnalités résultantes</mat-card-title></mat-card-header>
          <mat-card-content>
            @if (p.resultingFeatures?.length) {
              <mat-chip-set data-cy="position-features">
                @for (f of p.resultingFeatures ?? []; track f) {
                  <mat-chip disableRipple>{{ f }}</mat-chip>
                }
              </mat-chip-set>
            } @else {
              <p class="muted" data-cy="position-features-empty">Aucune fonctionnalité accordée.</p>
            }
            <p class="muted">Titulaires actuels : <span data-cy="position-holders">{{ p.holdersCount ?? 0 }}</span></p>
            <button mat-stroked-button type="button" data-cy="position-toggle" (click)="toggleActive()">
              {{ p.active ? 'Désactiver' : 'Réactiver' }}
            </button>
          </mat-card-content>
        </mat-card>
      } @else if (notFound()) {
        <p class="err" role="alert" data-cy="position-not-found">Position introuvable.</p>
      } @else {
        <mat-progress-bar mode="indeterminate" aria-label="Chargement"></mat-progress-bar>
      }
    </section>
  `,
  styles: [
    `
      .page-head { display: flex; align-items: center; justify-content: space-between; gap: var(--ct-space-3); margin-top: var(--ct-space-3); }
      .block { margin-top: var(--ct-space-4); }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0 var(--ct-space-3); }
      .wide { grid-column: 1 / -1; }
      .actions { display: flex; justify-content: flex-end; }
      .muted { color: var(--ct-color-muted); }
      .ok { color: var(--ct-green-600); }
      .err { color: var(--ct-red-700); }
      mat-chip[data-state='ACTIVE'] { --mdc-chip-elevated-container-color: var(--ct-green-50); color: var(--ct-green-600); }
      mat-chip[data-state='INACTIVE'] { --mdc-chip-elevated-container-color: var(--ct-color-surface-alt); color: var(--ct-color-muted); }
      mat-chip[data-state='PENDING'] { --mdc-chip-elevated-container-color: var(--ct-amber-50); color: var(--ct-amber-700); }
    `,
  ],
})
export class PositionEditorPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly positionsSvc = inject(PositionsService);
  private readonly rolesSvc = inject(RolesService);

  readonly position = signal<Position | null>(null);
  readonly roleOptions = signal<{ id: string; code: string; label: { fr: string } }[]>([]);
  readonly notFound = signal(false);
  readonly ok = signal<string | null>(null);
  readonly error = signal<number | null>(null);
  readonly scopes = Object.keys(POSITION_SCOPE_LABELS) as (keyof typeof POSITION_SCOPE_LABELS)[];

  /** Saisie locale du formulaire ; le serveur reste seul décideur (rang, portée, rôles, SoD). */
  form = { fr: '', ar: '', en: '', rank: 1, scope: 'UNIT' as keyof typeof POSITION_SCOPE_LABELS, maxHoldersPerUnit: null as number | null, roleIds: [] as string[] };

  private positionId = '';

  ngOnInit(): void {
    this.positionId = this.route.snapshot.paramMap.get('positionId') ?? '';
    this.rolesSvc.getRoleFeatureMatrix().subscribe((m) => this.roleOptions.set(m.roles));
    this.positionsSvc.getPosition(this.positionId).subscribe({
      next: (p) => this.apply(p),
      error: () => this.notFound.set(true),
    });
  }

  scopeLabel(s: keyof typeof POSITION_SCOPE_LABELS): string {
    return POSITION_SCOPE_LABELS[s] ?? s;
  }

  errorHint(code: number): string {
    return code === 403 ? 'vous occupez cette position, elle ne peut pas être modifiée par vous-même' : 'modification non acceptée par le serveur';
  }

  save(): void {
    const p = this.position();
    if (!p) return;
    this.ok.set(null);
    this.error.set(null);
    const body: PositionInput = {
      version: p.version ?? 0,
      code: p.code,
      label: { fr: this.form.fr, ar: this.form.ar || undefined, en: this.form.en || undefined },
      rank: this.form.rank,
      scope: this.form.scope,
      unitTypeId: p.unitTypeId,
      reportsToId: p.reportsToId,
      maxHoldersPerUnit: this.form.maxHoldersPerUnit ?? undefined,
      roleIds: this.form.roleIds,
    };
    this.positionsSvc.updatePosition(this.positionId, body).subscribe({
      next: (updated) => {
        this.apply(updated);
        this.ok.set(updated.pendingChange ? 'Modification enregistrée — en attente de double validation (fonctionnalité sensible).' : 'Position enregistrée.');
      },
      error: (e: HttpErrorResponse) => this.error.set(e.status),
    });
  }

  toggleActive(): void {
    const p = this.position();
    if (!p) return;
    const actionCode = p.active ? 'deactivate' : 'reactivate';
    this.positionsSvc.performPositionAction(this.positionId, actionCode, { version: p.version ?? 0 }).subscribe({
      next: (updated) => this.apply(updated),
      error: (e: HttpErrorResponse) => this.error.set(e.status),
    });
  }

  private apply(p: Position): void {
    this.position.set(p);
    this.form = {
      fr: p.label.fr,
      ar: p.label.ar ?? '',
      en: p.label.en ?? '',
      rank: p.rank,
      scope: p.scope,
      maxHoldersPerUnit: p.maxHoldersPerUnit ?? null,
      roleIds: (p.roles ?? []).map((r) => r.id),
    };
  }
}
