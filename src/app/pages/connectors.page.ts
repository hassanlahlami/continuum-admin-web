import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import {
  AvailableAction,
  Connector,
  ConnectorExecutionPage,
  ConnectorsService,
} from '../../../libs/api-clients/operations';

/**
 * Connecteurs ERP/CBS (Admin Système, §2.3/§10) : santé, circuit breaker, dernier test, journal d'exécution.
 * Les actions (tester, activer, désactiver, réinitialiser le breaker) viennent du serveur
 * (`availableActions`) ; le motif est exigé quand l'action le demande. Droit `ops.connector.read`/`manage`.
 * Sélecteurs `data-cy` (D36).
 */
@Component({
  selector: 'ct-connectors',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    RouterLink,
  ],
  template: `
    <section>
      <h1>Connecteurs</h1>
      @if (error()) {
        <p class="error" role="alert" data-cy="connectors-error">{{ error() }}</p>
      }
      @if (connectors(); as list) {
        <mat-card appearance="outlined" class="table-card">
          <table mat-table [dataSource]="list" data-cy="connectors-table">
            <ng-container matColumnDef="code">
              <th mat-header-cell *matHeaderCellDef>Code</th>
              <td mat-cell *matCellDef="let c"><code>{{ c.code }}</code></td>
            </ng-container>
            <ng-container matColumnDef="kind">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let c">{{ c.kind }}</td>
            </ng-container>
            <ng-container matColumnDef="endpoint">
              <th mat-header-cell *matHeaderCellDef>Point d'accès</th>
              <td mat-cell *matCellDef="let c" class="muted">{{ c.endpoint }}</td>
            </ng-container>
            <ng-container matColumnDef="health">
              <th mat-header-cell *matHeaderCellDef>Santé</th>
              <td mat-cell *matCellDef="let c">
                <span class="health" [attr.data-health]="c.health" data-cy="connector-health">{{ c.health }}</span>
                @if (c.circuitBreaker) { <span class="muted"> · CB {{ c.circuitBreaker }}</span> }
                @if (!c.enabled) { <span class="muted"> · désactivé</span> }
              </td>
            </ng-container>
            <ng-container matColumnDef="last">
              <th mat-header-cell *matHeaderCellDef>Dernière exécution</th>
              <td mat-cell *matCellDef="let c">{{ c.lastExecutionAt ? (c.lastExecutionAt | date: 'dd/MM/yyyy HH:mm') : '—' }}</td>
            </ng-container>
            <tr mat-header-row *matHeaderRowDef="cols"></tr>
            <tr mat-row *matRowDef="let c; columns: cols" class="clickable" data-cy="connector-row"
                [class.selected]="selected()?.id === c.id" (click)="select(c)"></tr>
          </table>
        </mat-card>
      } @else {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }

      @if (selected(); as c) {
        <mat-card appearance="outlined" class="detail" data-cy="connector-detail">
          <mat-card-content>
            <h2>{{ c.code }} <a [routerLink]="['/connectors', c.id]" class="open" data-cy="connector-open">Configuration, mapping et journal →</a></h2>
            <p class="muted">
              {{ c.kind }}{{ c.erpType ? ' · ' + c.erpType : '' }} · timeout {{ c.timeoutMs ?? '—' }} ms
              @if (c.lastTestResult; as t) {
                · dernier test :
                <span data-cy="connector-test-result">{{ t.success ? 'succès' : 'échec' }} ({{ t.latencyMs }} ms) {{ t.message }}</span>
              }
            </p>
            @if (c.availableActions?.length) {
              <div class="actions">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dense">
                  <mat-label>Motif</mat-label>
                  <input matInput #reason name="reason" data-cy="connector-reason" />
                </mat-form-field>
                @for (a of c.availableActions; track a.code) {
                  <button mat-stroked-button type="button" [attr.data-cy]="'connector-action-' + a.code"
                          [disabled]="busy() || (a.requiresComment && !reason.value.trim())"
                          (click)="run(c, a, reason.value); reason.value = ''">{{ a.label }}</button>
                }
              </div>
            }
            <h3>Journal d'exécution</h3>
            @if (executions(); as ex) {
              <table mat-table [dataSource]="ex.items" data-cy="executions-table">
                <ng-container matColumnDef="at">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let e">{{ e.at | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
                </ng-container>
                <ng-container matColumnDef="operation">
                  <th mat-header-cell *matHeaderCellDef>Opération</th>
                  <td mat-cell *matCellDef="let e">{{ e.operation }}</td>
                </ng-container>
                <ng-container matColumnDef="outcome">
                  <th mat-header-cell *matHeaderCellDef>Résultat</th>
                  <td mat-cell *matCellDef="let e">{{ e.outcome }}</td>
                </ng-container>
                <ng-container matColumnDef="durationMs">
                  <th mat-header-cell *matHeaderCellDef>Durée (ms)</th>
                  <td mat-cell *matCellDef="let e">{{ e.durationMs }}</td>
                </ng-container>
                <ng-container matColumnDef="records">
                  <th mat-header-cell *matHeaderCellDef>Volume</th>
                  <td mat-cell *matCellDef="let e">{{ e.records }}</td>
                </ng-container>
                <tr mat-header-row *matHeaderRowDef="exCols"></tr>
                <tr mat-row *matRowDef="let e; columns: exCols" data-cy="execution-row"></tr>
              </table>
              @if (!ex.items.length) { <p class="muted">Aucune exécution.</p> }
            }
          </mat-card-content>
        </mat-card>
      }
    </section>
  `,
  styles: [
    `
      .table-card { margin-top: var(--ct-space-4); padding: 0; overflow: hidden; }
      table[mat-table] { width: 100%; background: transparent; }
      code { font-family: var(--ct-font-mono); font-size: 0.82em; }
      .muted { color: var(--ct-color-muted); }
      .error { color: var(--ct-red-700); }
      tr.clickable { cursor: pointer; }
      tr.clickable:hover, tr.selected { background: var(--ct-color-primary-soft); }
      .open { font-size: 0.8rem; font-weight: 400; margin-left: var(--ct-space-3); }
      .health { font-weight: 600; }
      .health[data-health='UP'] { color: var(--ct-green-600); }
      .health[data-health='DOWN'] { color: var(--ct-red-700); }
      .detail { margin-top: var(--ct-space-4); }
      .actions { display: flex; flex-wrap: wrap; gap: var(--ct-space-3); align-items: center; margin: var(--ct-space-3) 0; }
      .actions .dense { width: 240px; }
    `,
  ],
})
export class ConnectorsPage implements OnInit {
  private readonly service = inject(ConnectorsService);
  readonly cols = ['code', 'kind', 'endpoint', 'health', 'last'];
  readonly exCols = ['at', 'operation', 'outcome', 'durationMs', 'records'];
  readonly connectors = signal<Connector[] | null>(null);
  readonly selected = signal<Connector | null>(null);
  readonly executions = signal<ConnectorExecutionPage | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');

  ngOnInit(): void {
    this.service.listConnectors().subscribe({
      next: (l) => this.connectors.set(l),
      error: () => this.error.set('Impossible de charger les connecteurs.'),
    });
  }

  select(c: Connector): void {
    this.selected.set(c);
    this.executions.set(null);
    this.service.listConnectorExecutions(c.id).subscribe({
      next: (p) => this.executions.set(p),
      error: () => this.error.set("Impossible de charger le journal d'exécution."),
    });
  }

  run(c: Connector, a: AvailableAction, comment: string): void {
    if (a.confirmationMessage && !window.confirm(a.confirmationMessage)) return;
    this.busy.set(true);
    this.error.set('');
    this.service
      .performConnectorAction(c.id, a.code, { version: c.version ?? 0, comment: comment.trim() || undefined })
      .subscribe({
        next: (u) => {
          this.busy.set(false);
          this.selected.set(u);
          this.connectors.update((l) => (l ?? []).map((x) => (x.id === u.id ? u : x)));
        },
        error: () => {
          this.busy.set(false);
          this.error.set(`Action « ${a.label} » refusée ou en échec.`);
        },
      });
  }
}
