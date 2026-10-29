import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { ComponentHealth, HealthService, ScheduledJob } from '../../../libs/api-clients/operations';

/** Période de rafraîchissement automatique de la supervision (règle OPS-11 : rafraîchissement périodique). */
const REFRESH_MS = 30_000;

/**
 * Supervision (OPS-11) : santé par composant et par instance (`getPlatformHealth`), version de schéma par entité
 * face à la version attendue par le build (§4.3.5) et travaux planifiés en lecture seule (`listScheduledJobs`).
 * Droit `ops.health.read` appliqué par le serveur (403). Sélecteurs `data-cy` (D36).
 */
@Component({
  selector: 'ct-health',
  standalone: true,
  imports: [DatePipe, MatCardModule, MatProgressBarModule, MatTableModule],
  template: `
    <section>
      <header class="page-head"><h1>Supervision</h1></header>
      <p class="page-sub">État des composants de la plateforme, versions de schéma et travaux planifiés. Rafraîchi automatiquement.</p>

      @if (error()) {
        <p class="error" role="alert" data-cy="health-error">{{ error() }}</p>
      }
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Chargement" data-cy="health-loading"></mat-progress-bar>
      }

      @if (components(); as list) {
        @if (!list.length) {
          <p class="muted" data-cy="health-empty">Aucun composant supervisé.</p>
        } @else {
          <mat-card appearance="outlined" class="card">
            <mat-card-content>
              <h2>Composants</h2>
              <table mat-table [dataSource]="list" data-cy="health-table">
                <ng-container matColumnDef="component">
                  <th mat-header-cell *matHeaderCellDef>Composant</th>
                  <td mat-cell *matCellDef="let c"><code>{{ c.component }}</code></td>
                </ng-container>
                <ng-container matColumnDef="node">
                  <th mat-header-cell *matHeaderCellDef>Instance</th>
                  <td mat-cell *matCellDef="let c">{{ c.node ?? '—' }}</td>
                </ng-container>
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>État</th>
                  <td mat-cell *matCellDef="let c">
                    <span class="status" [attr.data-status]="c.status" data-cy="health-status">{{ statusLabel(c.status) }}</span>
                  </td>
                </ng-container>
                <ng-container matColumnDef="detail">
                  <th mat-header-cell *matHeaderCellDef>Détail</th>
                  <td mat-cell *matCellDef="let c" class="muted">{{ c.detail ?? '—' }}</td>
                </ng-container>
                <ng-container matColumnDef="checkedAt">
                  <th mat-header-cell *matHeaderCellDef>Vérifié</th>
                  <td mat-cell *matCellDef="let c">{{ c.checkedAt ? (c.checkedAt | date: 'dd/MM/yyyy HH:mm:ss') : '—' }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="cols"></tr>
                <tr mat-row *matRowDef="let row; columns: cols" data-cy="health-row"></tr>
              </table>
            </mat-card-content>
          </mat-card>

          @if (schemas().length) {
            <mat-card appearance="outlined" class="card">
              <mat-card-content>
                <h2>Versions de schéma par entité</h2>
                <table mat-table [dataSource]="schemas()" data-cy="schema-table">
                  <ng-container matColumnDef="entityCode">
                    <th mat-header-cell *matHeaderCellDef>Entité</th>
                    <td mat-cell *matCellDef="let s">{{ s.entityCode }}</td>
                  </ng-container>
                  <ng-container matColumnDef="appliedVersion">
                    <th mat-header-cell *matHeaderCellDef>Appliquée</th>
                    <td mat-cell *matCellDef="let s"><code>{{ s.appliedVersion }}</code></td>
                  </ng-container>
                  <ng-container matColumnDef="expectedVersion">
                    <th mat-header-cell *matHeaderCellDef>Attendue</th>
                    <td mat-cell *matCellDef="let s"><code>{{ s.expectedVersion }}</code></td>
                  </ng-container>
                  <ng-container matColumnDef="pendingMigrations">
                    <th mat-header-cell *matHeaderCellDef>Migrations en attente</th>
                    <td mat-cell *matCellDef="let s" data-cy="schema-pending"
                        [class.behind]="s.pendingMigrations">{{ s.pendingMigrations ?? 0 }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="schemaCols"></tr>
                  <tr mat-row *matRowDef="let row; columns: schemaCols" data-cy="schema-row"></tr>
                </table>
              </mat-card-content>
            </mat-card>
          }
        }
      }

      @if (jobs().length) {
        <mat-card appearance="outlined" class="card">
          <mat-card-content>
            <h2>Travaux planifiés</h2>
            <table mat-table [dataSource]="jobs()" data-cy="jobs-table">
              <ng-container matColumnDef="label">
                <th mat-header-cell *matHeaderCellDef>Travail</th>
                <td mat-cell *matCellDef="let j">{{ j.label }}</td>
              </ng-container>
              <ng-container matColumnDef="state">
                <th mat-header-cell *matHeaderCellDef>État</th>
                <td mat-cell *matCellDef="let j" data-cy="job-state">{{ j.state }}</td>
              </ng-container>
              <ng-container matColumnDef="lastRunAt">
                <th mat-header-cell *matHeaderCellDef>Dernière exécution</th>
                <td mat-cell *matCellDef="let j">{{ j.lastRunAt ? (j.lastRunAt | date: 'dd/MM/yyyy HH:mm') : '—' }}{{ j.lastOutcome ? ' · ' + j.lastOutcome : '' }}</td>
              </ng-container>
              <ng-container matColumnDef="nextRunAt">
                <th mat-header-cell *matHeaderCellDef>Prochaine</th>
                <td mat-cell *matCellDef="let j">{{ j.nextRunAt ? (j.nextRunAt | date: 'dd/MM/yyyy HH:mm') : '—' }}</td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="jobCols"></tr>
              <tr mat-row *matRowDef="let row; columns: jobCols" data-cy="job-row"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      }
    </section>
  `,
  styles: [
    `
      .page-sub { color: var(--ct-color-muted); margin-top: 0; max-width: 72ch; }
      .error { color: var(--ct-red-700); }
      .card { margin-top: var(--ct-space-4); }
      h2 { margin-top: 0; }
      table[mat-table] { width: 100%; background: transparent; }
      code { font-family: var(--ct-font-mono); font-size: 0.82em; }
      .muted { color: var(--ct-color-muted); }
      .status { font-weight: 600; }
      .status[data-status='UP'] { color: var(--ct-green-600); }
      .status[data-status='DEGRADED'] { color: var(--ct-amber-700); }
      .status[data-status='DOWN'] { color: var(--ct-red-700); }
      .behind { color: var(--ct-amber-700); font-weight: 600; }
    `,
  ],
})
export class HealthPage implements OnInit, OnDestroy {
  private readonly service = inject(HealthService);
  readonly cols = ['component', 'node', 'status', 'detail', 'checkedAt'];
  readonly schemaCols = ['entityCode', 'appliedVersion', 'expectedVersion', 'pendingMigrations'];
  readonly jobCols = ['label', 'state', 'lastRunAt', 'nextRunAt'];
  readonly components = signal<ComponentHealth[] | null>(null);
  readonly jobs = signal<ScheduledJob[]>([]);
  readonly schemas = signal<NonNullable<ComponentHealth['schemaVersions']>>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  private timer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.load();
    this.timer = setInterval(() => this.load(), REFRESH_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.timer);
  }

  statusLabel(s: ComponentHealth['status']): string {
    return s === 'UP' ? 'Opérationnel' : s === 'DEGRADED' ? 'Dégradé' : 'Hors service';
  }

  private load(): void {
    this.service.getPlatformHealth().subscribe({
      next: (list) => {
        this.components.set(list);
        this.schemas.set(list.flatMap((c) => c.schemaVersions ?? []));
        this.error.set('');
        this.loading.set(false);
      },
      error: (e: HttpErrorResponse) => {
        this.components.set(null);
        this.loading.set(false);
        this.error.set(e.status === 403 ? 'Accès refusé : droit ops.health.read requis.' : 'Impossible de charger la supervision.');
      },
    });
    this.service.listScheduledJobs().subscribe({
      next: (j) => this.jobs.set(j),
      error: () => this.jobs.set([]),
    });
  }
}
