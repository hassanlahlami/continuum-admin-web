import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import { Position, PositionsService } from '../../../libs/api-clients/admin-iam';
import { POSITION_SCOPE_LABELS } from '../iam.labels';

/**
 * Positions du tenant (ADM-07, §2.1) : liste des positions avec leur rang, leur portée, leur rattachement
 * et leurs titulaires, lue via `listPositions` (client généré, D32). Le libellé seul s'affiche — jamais le
 * code. Les positions désactivées sont masquées par défaut (bascule `includeInactive`, filtre serveur).
 * Le front n'enforce aucune règle : le serveur applique le périmètre `admin.position.read`.
 */
@Component({
  selector: 'ct-positions',
  standalone: true,
  imports: [
    FormsModule,
    MatCardModule,
    MatChipsModule,
    MatIconModule,
    MatProgressBarModule,
    MatSlideToggleModule,
    MatTableModule,
    RouterLink,
  ],
  template: `
    <section>
      <header class="page-head">
        <h1>Positions</h1>
      </header>
      <p class="page-sub">Positions de l'entité, leur rang, leur portée et leurs titulaires. Une position se désactive, elle ne se supprime pas.</p>

      <mat-card appearance="outlined">
        <mat-card-content>
          <div class="filters">
            <mat-slide-toggle [ngModel]="includeInactive()" (ngModelChange)="setIncludeInactive($event)" data-cy="positions-include-inactive">
              Afficher les positions désactivées
            </mat-slide-toggle>
          </div>

          @if (loading()) {
            <mat-progress-bar mode="indeterminate" data-cy="positions-loading"></mat-progress-bar>
          }

          @if (positions().length) {
            <table mat-table [dataSource]="positions()" data-cy="positions-table">
              <ng-container matColumnDef="label">
                <th mat-header-cell *matHeaderCellDef>Position</th>
                <td mat-cell *matCellDef="let p">
                  <a class="label" [routerLink]="['/positions', p.id]" data-cy="position-link">{{ p.label.fr }}</a>
                  @if (p.fromPack) { <span class="pack" data-cy="position-pack">Pack</span> }
                </td>
              </ng-container>
              <ng-container matColumnDef="rank">
                <th mat-header-cell *matHeaderCellDef>Rang</th>
                <td mat-cell *matCellDef="let p" data-cy="position-rank">{{ p.rank }}</td>
              </ng-container>
              <ng-container matColumnDef="unitType">
                <th mat-header-cell *matHeaderCellDef>Type d'unité</th>
                <td mat-cell *matCellDef="let p">{{ p.unitTypeLabel ?? 'Niveau entité' }}</td>
              </ng-container>
              <ng-container matColumnDef="scope">
                <th mat-header-cell *matHeaderCellDef>Portée</th>
                <td mat-cell *matCellDef="let p">{{ scopeLabel(p.scope) }}</td>
              </ng-container>
              <ng-container matColumnDef="reportsTo">
                <th mat-header-cell *matHeaderCellDef>Rattachée à</th>
                <td mat-cell *matCellDef="let p">{{ p.reportsToLabel ?? '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="holders">
                <th mat-header-cell *matHeaderCellDef>Titulaires</th>
                <td mat-cell *matCellDef="let p" data-cy="position-holders">{{ p.holdersCount ?? 0 }}</td>
              </ng-container>
              <ng-container matColumnDef="state">
                <th mat-header-cell *matHeaderCellDef>État</th>
                <td mat-cell *matCellDef="let p">
                  <mat-chip-set>
                    <mat-chip disableRipple [attr.data-state]="p.active ? 'ACTIVE' : 'INACTIVE'">{{ p.active ? 'Active' : 'Désactivée' }}</mat-chip>
                    @if (p.pendingChange) { <mat-chip disableRipple data-state="PENDING" data-cy="position-pending">Modification en attente</mat-chip> }
                  </mat-chip-set>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
              <tr mat-row *matRowDef="let row; columns: columns" data-cy="position-row"></tr>
            </table>
          } @else if (!loading()) {
            <p class="muted" data-cy="positions-empty">Aucune position.</p>
          }
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .page-head { display: flex; align-items: center; justify-content: space-between; gap: var(--ct-space-3); }
      .page-sub { color: var(--ct-color-muted); margin-top: 0; max-width: 72ch; }
      .filters { display: flex; align-items: center; gap: var(--ct-space-3); margin-bottom: var(--ct-space-3); }
      table[mat-table] { width: 100%; background: transparent; }
      .label { font-weight: 600; color: inherit; text-decoration: none; }
      .label:hover { text-decoration: underline; }
      .pack { margin-left: var(--ct-space-2); font-size: 0.75rem; color: var(--ct-color-muted); border: 1px solid var(--ct-color-border); border-radius: 999px; padding: 0 var(--ct-space-2); }
      .muted { color: var(--ct-color-muted); }
      mat-chip[data-state='ACTIVE'] { --mdc-chip-elevated-container-color: var(--ct-green-50); color: var(--ct-green-600); }
      mat-chip[data-state='INACTIVE'] { --mdc-chip-elevated-container-color: var(--ct-color-surface-alt); color: var(--ct-color-muted); }
      mat-chip[data-state='PENDING'] { --mdc-chip-elevated-container-color: var(--ct-amber-50); color: var(--ct-amber-700); }
    `,
  ],
})
export class PositionsPage implements OnInit {
  private readonly positionsSvc = inject(PositionsService);

  readonly positions = signal<Position[]>([]);
  readonly includeInactive = signal(false);
  readonly loading = signal(false);
  readonly columns = ['label', 'rank', 'unitType', 'scope', 'reportsTo', 'holders', 'state'];

  ngOnInit(): void {
    this.load();
  }

  setIncludeInactive(on: boolean): void {
    this.includeInactive.set(on);
    this.load();
  }

  scopeLabel(s: keyof typeof POSITION_SCOPE_LABELS): string {
    return POSITION_SCOPE_LABELS[s] ?? s;
  }

  private load(): void {
    this.loading.set(true);
    this.positionsSvc.listPositions(this.includeInactive()).subscribe({
      next: (list) => {
        this.positions.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
