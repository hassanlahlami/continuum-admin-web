import { DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { Observable } from 'rxjs';
import { CacheRegion, CachesService, EvictionResult } from '../../../libs/api-clients/operations';

/** Longueur minimale du motif de purge (`minLength` du contrat `Reason`, journalisé côté serveur). */
const REASON_MIN_LENGTH = 10;

/**
 * Caches de paramétrage (OPS-07, §4.3.4) : régions Ehcache avec entrées, mémoire, taux de succès, durée de vie,
 * dernière purge et état par instance, lues via `listCaches`. Une purge (région ou totale) exige un motif et une
 * confirmation qui affiche l'étendue ; le résultat donne le nombre d'instances ayant accusé réception.
 * Les droits (`admin.cache.evict`, `admin.cache.evict.all`) sont appliqués par le serveur (403) ; la limitation de
 * fréquence remonte en 429. Sélecteurs `data-cy` (D36).
 */
@Component({
  selector: 'ct-caches',
  standalone: true,
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTableModule,
  ],
  template: `
    <section>
      <header class="page-head">
        <h1>Caches de paramétrage</h1>
      </header>
      <p class="page-sub">Régions de cache partagées par les instances. Une purge diffuse l'invalidation à toutes les instances ; le motif est journalisé.</p>

      @if (error()) {
        <p class="error" role="alert" data-cy="caches-error">{{ error() }}</p>
      }
      @if (result()) {
        <p class="result" role="status" data-cy="caches-result">{{ result() }}</p>
      }

      <mat-card appearance="outlined" class="table-card">
        <mat-card-content>
          <div class="toolbar">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="reason">
              <mat-label>Motif de purge</mat-label>
              <input matInput name="reason" [ngModel]="reason()" (ngModelChange)="reason.set($event)" data-cy="caches-reason" />
            </mat-form-field>
            <button mat-stroked-button type="button" data-cy="caches-purge-all"
                    [disabled]="busy() || !reasonValid()" (click)="purgeAll()">
              <mat-icon aria-hidden="true">delete_sweep</mat-icon> Tout purger
            </button>
          </div>

          @if (busy() || !regions()) {
            <mat-progress-bar mode="indeterminate" data-cy="caches-loading"></mat-progress-bar>
          }

          @if (regions(); as list) {
            <table mat-table [dataSource]="list" data-cy="caches-table">
              <ng-container matColumnDef="region">
                <th mat-header-cell *matHeaderCellDef>Région</th>
                <td mat-cell *matCellDef="let c"><code>{{ c.region }}</code></td>
              </ng-container>
              <ng-container matColumnDef="entries">
                <th mat-header-cell *matHeaderCellDef>Entrées</th>
                <td mat-cell *matCellDef="let c" data-cy="cache-entries">{{ c.entries | number }}</td>
              </ng-container>
              <ng-container matColumnDef="memory">
                <th mat-header-cell *matHeaderCellDef>Mémoire</th>
                <td mat-cell *matCellDef="let c">{{ memory(c) }}</td>
              </ng-container>
              <ng-container matColumnDef="hitRatio">
                <th mat-header-cell *matHeaderCellDef>Taux de succès</th>
                <td mat-cell *matCellDef="let c" data-cy="cache-hit-ratio">{{ hitRatio(c) }}</td>
              </ng-container>
              <ng-container matColumnDef="ttl">
                <th mat-header-cell *matHeaderCellDef>Durée de vie</th>
                <td mat-cell *matCellDef="let c">{{ c.ttl ?? '—' }}</td>
              </ng-container>
              <ng-container matColumnDef="instances">
                <th mat-header-cell *matHeaderCellDef>Instances</th>
                <td mat-cell *matCellDef="let c" class="muted" data-cy="cache-instances">
                  @for (i of c.instances ?? []; track i.node) {
                    <div>{{ i.node }} : {{ i.entries | number }}</div>
                  } @empty {
                    —
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="lastEviction">
                <th mat-header-cell *matHeaderCellDef>Dernière purge</th>
                <td mat-cell *matCellDef="let c" data-cy="cache-last-eviction">
                  @if (c.lastEviction; as e) {
                    <div>{{ e.at | date: 'dd/MM/yyyy HH:mm' }}{{ e.by ? ' · ' + e.by.displayName : '' }}</div>
                    @if (e.reason) { <div class="muted">{{ e.reason }}</div> }
                  } @else {
                    —
                  }
                </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef></th>
                <td mat-cell *matCellDef="let c">
                  <button mat-button type="button" data-cy="cache-purge"
                          [disabled]="busy() || !reasonValid()" (click)="purgeRegion(c)">Purger</button>
                </td>
              </ng-container>
              <tr mat-header-row *matHeaderRowDef="cols; sticky: true"></tr>
              <tr mat-row *matRowDef="let row; columns: cols" data-cy="cache-row"></tr>
            </table>
            @if (!list.length) { <p class="muted" data-cy="caches-empty">Aucune région de cache.</p> }
          }
        </mat-card-content>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .page-head { display: flex; align-items: center; justify-content: space-between; gap: var(--ct-space-3); }
      .page-sub { color: var(--ct-color-muted); margin-top: 0; max-width: 72ch; }
      .error { color: var(--ct-red-700); }
      .result { color: var(--ct-green-600); font-weight: 600; }
      .table-card { margin-top: var(--ct-space-4); padding: 0; overflow: hidden; }
      .toolbar { display: flex; flex-wrap: wrap; gap: var(--ct-space-3); align-items: center; margin-bottom: var(--ct-space-3); }
      .toolbar .reason { width: 320px; }
      table[mat-table] { width: 100%; background: transparent; }
      code { font-family: var(--ct-font-mono); font-size: 0.82em; }
      .muted { color: var(--ct-color-muted); }
    `,
  ],
})
export class CachesPage implements OnInit {
  private readonly service = inject(CachesService);
  readonly cols = ['region', 'entries', 'memory', 'hitRatio', 'ttl', 'instances', 'lastEviction', 'actions'];
  readonly regions = signal<CacheRegion[] | null>(null);
  readonly reason = signal('');
  readonly reasonValid = computed(() => this.reason().trim().length >= REASON_MIN_LENGTH);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly result = signal('');

  ngOnInit(): void {
    this.load();
  }

  memory(c: CacheRegion): string {
    return c.heapBytes === undefined ? '—' : `${Math.round(c.heapBytes / 1024)} Kio`;
  }

  hitRatio(c: CacheRegion): string {
    return c.hitRatio === undefined ? '—' : `${Math.round(c.hitRatio * 100)} %`;
  }

  purgeRegion(c: CacheRegion): void {
    this.purge(
      `Purger la région « ${c.region} » sur toutes les instances ?`,
      () => this.service.evictCacheRegion(c.region, this.reason().trim()),
      `Région « ${c.region} » purgée`,
    );
  }

  purgeAll(): void {
    this.purge(
      "Purger toutes les régions de l'installation sur toutes les instances ?",
      () => this.service.evictCaches(this.reason().trim()),
      'Toutes les régions purgées',
    );
  }

  private load(): void {
    this.service.listCaches().subscribe({
      next: (list) => this.regions.set(list),
      error: () => this.error.set('Impossible de charger les caches.'),
    });
  }

  private purge(confirmation: string, call: () => Observable<EvictionResult>, done: string): void {
    if (!this.reasonValid() || !window.confirm(confirmation)) return;
    this.busy.set(true);
    this.error.set('');
    this.result.set('');
    call().subscribe({
      next: (r) => {
        this.busy.set(false);
        this.result.set(`${done} : ${r.instancesAcknowledged}/${r.instancesExpected} instances purgées.`);
        this.reason.set('');
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.busy.set(false);
        this.error.set(
          e.status === 429 ? 'Trop de purges demandées : réessayez dans un instant.' : 'La purge a échoué ou n’est pas autorisée.',
        );
      },
    });
  }
}
