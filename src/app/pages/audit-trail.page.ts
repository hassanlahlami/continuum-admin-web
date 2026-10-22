import { DatePipe } from '@angular/common';
import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTable, MatTableModule } from '@angular/material/table';
import { AuditEventPage, AuditEventPageAllOfItems as AuditEvent, AuditTrailService } from '../../../libs/api-clients/operations';

/**
 * Piste d'audit des opérations (Admin Système, §2.3/§10) : qui a fait quoi, quand, sur quel objet —
 * journal chaîné et signé (HMAC). Recherche multicritère **côté serveur** reflétée dans l'URL
 * (`?from=&to=&eventType=&objectType=&page=`, partageable), droit `ops.audittrail.read`. Lecture seule.
 * Style « épuré & dense » : filtres compacts, table serrée. Sélecteurs `data-cy` (D36).
 */
@Component({
  selector: 'ct-audit-trail',
  standalone: true,
  imports: [
    DatePipe,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
  ],
  template: `
    <section>
      <h1>Piste d'audit des opérations</h1>
      <mat-card appearance="outlined">
        <mat-card-content>
          <form class="filters" (submit)="$event.preventDefault(); apply(fromF.value, toF.value, typeF.value, objF.value)">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dense">
              <mat-label>Du</mat-label>
              <input matInput #fromF type="date" name="from" [value]="filters().from" data-cy="audit-from" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dense">
              <mat-label>Au</mat-label>
              <input matInput #toF type="date" name="to" [value]="filters().to" data-cy="audit-to" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dense">
              <mat-label>Type d'événement</mat-label>
              <input matInput #typeF name="eventType" [value]="filters().eventType" placeholder="ex. FINDING_VALIDATED" data-cy="audit-event-type" />
            </mat-form-field>
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dense">
              <mat-label>Type d'objet</mat-label>
              <input matInput #objF name="objectType" [value]="filters().objectType" placeholder="ex. FINDING" data-cy="audit-object-type" />
            </mat-form-field>
            <div class="filter-actions">
              <button mat-flat-button color="primary" type="submit" data-cy="audit-apply">Filtrer</button>
              <button mat-stroked-button type="button" (click)="reset()" data-cy="audit-reset">Réinitialiser</button>
            </div>
          </form>
        </mat-card-content>
      </mat-card>

      @if (page(); as p) {
        @if (p.items.length) {
          <mat-card appearance="outlined" class="table-card">
            <table mat-table [dataSource]="p.items" multiTemplateDataRows data-cy="audit-table">
              <ng-container matColumnDef="expand">
                <th mat-header-cell *matHeaderCellDef aria-label="Détail"></th>
                <td mat-cell *matCellDef="let e">
                  @if (hasDiff(e)) {
                    <mat-icon class="chev" [class.open]="isExpanded(e)">chevron_right</mat-icon>
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="at">
                <th mat-header-cell *matHeaderCellDef>Date</th>
                <td mat-cell *matCellDef="let e">{{ e.at | date: 'dd/MM/yyyy HH:mm' }}</td>
              </ng-container>
              <ng-container matColumnDef="actor">
                <th mat-header-cell *matHeaderCellDef>Acteur</th>
                <td mat-cell *matCellDef="let e">
                  {{ e.actor?.displayName ?? '—' }}
                  @if (e.actor?.positionLabel) { <span class="muted"> · {{ e.actor.positionLabel }}</span> }
                </td>
              </ng-container>
              <ng-container matColumnDef="eventType">
                <th mat-header-cell *matHeaderCellDef>Événement</th>
                <td mat-cell *matCellDef="let e">
                  <mat-chip-set><mat-chip disableRipple>{{ e.eventType }}</mat-chip></mat-chip-set>
                </td>
              </ng-container>
              <ng-container matColumnDef="object">
                <th mat-header-cell *matHeaderCellDef>Objet</th>
                <td mat-cell *matCellDef="let e"><span class="muted">{{ e.objectType }}</span> <code>{{ e.objectId }}</code></td>
              </ng-container>
              <ng-container matColumnDef="hash">
                <th mat-header-cell *matHeaderCellDef>Empreinte</th>
                <td mat-cell *matCellDef="let e"><code class="hash" [title]="e.chainHash">{{ e.chainHash }}</code></td>
              </ng-container>

              <ng-container matColumnDef="detail">
                <td mat-cell *matCellDef="let e" [attr.colspan]="columns.length">
                  <div class="detail" data-cy="audit-detail">
                    <table class="diff">
                      <thead><tr><th>Champ</th><th>Avant</th><th>Après</th></tr></thead>
                      <tbody>
                        @for (d of diff(e); track d.key) {
                          <tr [class.changed]="d.changed">
                            <td class="k">{{ d.key }}</td>
                            <td class="before">{{ d.before }}</td>
                            <td class="after">{{ d.after }}</td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
              <tr mat-row *matRowDef="let row; columns: columns" data-cy="audit-row"
                  class="data-row" [class.clickable]="hasDiff(row)" (click)="toggle(row)"></tr>
              <tr mat-row *matRowDef="let row; columns: ['detail']; when: isExpandedRow" class="detail-row"></tr>
            </table>
            <nav class="pager">
              <button mat-stroked-button type="button" (click)="go(p.page - 1)" [disabled]="p.page <= 0">Précédent</button>
              <span>Page {{ p.page + 1 }} / {{ p.totalPages }} · {{ p.totalItems }} événement(s)</span>
              <button mat-stroked-button type="button" (click)="go(p.page + 1)" [disabled]="p.page + 1 >= p.totalPages">Suivant</button>
            </nav>
          </mat-card>
        } @else {
          <p data-cy="audit-empty">Aucun événement pour ces critères.</p>
        }
      } @else {
        <mat-progress-bar mode="indeterminate" aria-label="Chargement"></mat-progress-bar>
      }
    </section>
  `,
  styles: [
    `
      .filters { display: flex; flex-wrap: wrap; gap: var(--ct-space-3); align-items: flex-start; }
      .filters .dense { width: 190px; }
      .filter-actions { display: flex; gap: var(--ct-space-2); align-items: center; height: 56px; }
      .table-card { margin-top: var(--ct-space-4); padding: 0; overflow: hidden; }
      table[mat-table] { width: 100%; background: transparent; }
      th.mat-mdc-header-cell { background: var(--ct-color-surface); }
      code { font-family: var(--ct-font-mono); font-size: 0.82em; }
      .hash { color: var(--ct-color-muted); }
      .muted { color: var(--ct-color-muted); }
      .pager { display: flex; align-items: center; gap: var(--ct-space-3); padding: var(--ct-space-3) var(--ct-space-4); }
      .pager span { color: var(--ct-color-muted); font-size: 0.85rem; }
      tr.clickable { cursor: pointer; }
      tr.clickable:hover { background: var(--ct-color-primary-soft); }
      tr.detail-row { height: 0; }
      tr.detail-row td { padding: 0; border-bottom-width: 0; }
      .chev { color: var(--ct-color-muted); transition: transform 0.15s; font-size: 20px; height: 20px; width: 20px; }
      .chev.open { transform: rotate(90deg); color: var(--ct-color-primary); }
      .detail { padding: var(--ct-space-3) var(--ct-space-4); background: var(--ct-color-surface-alt); }
      .diff { border-collapse: collapse; width: 100%; max-width: 560px; }
      .diff th { text-align: left; color: var(--ct-color-muted); font-weight: 600; font-size: 0.78rem; padding: 0 var(--ct-space-4) var(--ct-space-1) 0; }
      .diff td { padding: var(--ct-space-1) var(--ct-space-4) var(--ct-space-1) 0; font-family: var(--ct-font-mono); font-size: 0.82rem; vertical-align: top; }
      .diff td.k { color: var(--ct-color-muted); font-family: inherit; }
      .diff tr.changed td.before { color: var(--ct-red-700); }
      .diff tr.changed td.after { color: var(--ct-green-600); font-weight: 600; }
    `,
  ],
})
export class AuditTrailPage implements OnInit {
  private readonly service = inject(AuditTrailService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly page = signal<AuditEventPage | null>(null);
  readonly filters = signal<{ from: string; to: string; eventType: string; objectType: string }>({
    from: '',
    to: '',
    eventType: '',
    objectType: '',
  });
  readonly columns = ['expand', 'at', 'actor', 'eventType', 'object', 'hash'];
  private readonly expandedId = signal<string | null>(null);
  @ViewChild(MatTable) private table?: MatTable<AuditEvent>;

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      const from = params.get('from') ?? '';
      const to = params.get('to') ?? '';
      const eventType = params.get('eventType') ?? '';
      const objectType = params.get('objectType') ?? '';
      const index = Math.max(0, Number(params.get('page') ?? 0) || 0);
      this.filters.set({ from, to, eventType, objectType });
      this.page.set(null);
      this.service
        .searchAuditTrail(
          index,
          20,
          from ? `${from}T00:00:00Z` : undefined,
          to ? `${to}T23:59:59Z` : undefined,
          undefined,
          objectType || undefined,
          undefined,
          eventType || undefined,
        )
        .subscribe((p) => this.page.set(p));
    });
  }

  apply(from: string, to: string, eventType: string, objectType: string): void {
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { from: from || null, to: to || null, eventType: eventType || null, objectType: objectType || null, page: 0 },
      queryParamsHandling: 'merge',
    });
  }

  reset(): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  go(index: number): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { page: index }, queryParamsHandling: 'merge' });
  }

  /** Un événement porte un détail si le serveur a journalisé un avant/après (création, modification, transition). */
  hasDiff(e: AuditEvent): boolean {
    return e.before != null || e.after != null;
  }

  isExpanded(e: AuditEvent): boolean {
    return this.expandedId() === e.id;
  }

  /** Prédicat de ligne de détail (signature Material : index, ligne). */
  readonly isExpandedRow = (_: number, row: AuditEvent): boolean => this.hasDiff(row) && this.expandedId() === row.id;

  toggle(e: AuditEvent): void {
    if (!this.hasDiff(e)) {
      return;
    }
    this.expandedId.set(this.isExpanded(e) ? null : (e.id ?? null));
    // MatTable ne réévalue pas les prédicats `when` sur un simple changement d'état → re-render explicite.
    this.table?.renderRows();
  }

  /** Différence avant→après : union des clés, valeur de chaque côté, marquée « changée » si elle diffère. */
  diff(e: AuditEvent): { key: string; before: string; after: string; changed: boolean }[] {
    const before = (e.before ?? {}) as Record<string, unknown>;
    const after = (e.after ?? {}) as Record<string, unknown>;
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
    return keys.map((key) => {
      const b = this.cell(before[key]);
      const a = this.cell(after[key]);
      return { key, before: b, after: a, changed: b !== a };
    });
  }

  private cell(value: unknown): string {
    if (value == null) {
      return '—';
    }
    return String(value);
  }
}
