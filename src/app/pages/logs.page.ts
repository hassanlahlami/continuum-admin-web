import { DatePipe, JsonPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import {
  ListSavedLogQueries200ResponseInner,
  LogLevelOverride,
  LogQuery,
  LogsService,
} from '../../../libs/api-clients/operations';

/** Longueur minimale du motif d'une surcharge de niveau (`minLength` du contrat, journalisée CTN-SEC-0010). */
const REASON_MIN_LENGTH = 10;

/** Périodes proposées : fenêtre glissante jusqu'à maintenant. */
const PERIODS: { value: string; label: string; ms: number }[] = [
  { value: '15m', label: '15 dernières minutes', ms: 15 * 60_000 },
  { value: '1h', label: 'Dernière heure', ms: 60 * 60_000 },
  { value: '24h', label: '24 dernières heures', ms: 24 * 60 * 60_000 },
];

/** Durées de surcharge proposées (ISO-8601 `PT…`) ; la valeur par défaut est celle du contrat (PT30M). */
const DURATIONS: { value: string; label: string }[] = [
  { value: 'PT15M', label: '15 minutes' },
  { value: 'PT30M', label: '30 minutes' },
  { value: 'PT1H', label: '1 heure' },
];

const LEVELS: LogQuery.LevelsEnum[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
const OVERRIDE_LEVELS: LogLevelOverride.LevelEnum[] = ['ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];

/** Colonnes d'une ligne ECS affichée en densité compacte (§10.3). */
type LogLine = Record<string, unknown>;

/**
 * Recherche de logs (OPS-08, §10.8) : flux technique ou sécurité, filtres période, niveaux, code d'événement,
 * module, référence de trace et texte ; résultats ECS en tableau compact, détail JSON au clic ; requêtes
 * sauvegardées. Second onglet « Niveaux de log » : surcharges temporaires actives (expiration automatique) et
 * formulaire d'activation avec motif obligatoire. La consultation est journalisée côté serveur ; les droits
 * (`admin.logs.*`, `admin.logs.level.change`) sont appliqués par le serveur (403). Sélecteurs `data-cy` (D36).
 */
@Component({
  selector: 'ct-logs',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    JsonPipe,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatTableModule,
    MatTabsModule,
  ],
  template: `
    <section>
      <header class="page-head">
        <h1>Recherche de logs</h1>
      </header>
      <p class="page-sub">Logs techniques et journal de sécurité. Chaque consultation est journalisée ; aucun log ne peut être supprimé.</p>

      @if (error()) {
        <p class="error" role="alert" data-cy="logs-error">{{ error() }}</p>
      }
      @if (result()) {
        <p class="result" role="status" data-cy="logs-result">{{ result() }}</p>
      }

      <mat-card appearance="outlined" class="card">
        <mat-card-content>
          <mat-tab-group>
            <mat-tab label="Flux">
              <div class="filters" data-cy="logs-filters">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Flux</mat-label>
                  <select matNativeControl name="stream" [ngModel]="stream()" (ngModelChange)="stream.set($event)" data-cy="logs-stream">
                    <option value="TECHNICAL">Technique</option>
                    <option value="SECURITY">Sécurité</option>
                  </select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Période</mat-label>
                  <select matNativeControl name="period" [ngModel]="period()" (ngModelChange)="period.set($event)" data-cy="logs-period">
                    @for (p of periods; track p.value) {
                      <option [value]="p.value">{{ p.label }}</option>
                    }
                  </select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Niveaux</mat-label>
                  <select matNativeControl multiple name="levels" [ngModel]="levels()" (ngModelChange)="levels.set($event)" data-cy="logs-levels">
                    @for (l of levelOptions; track l) {
                      <option [value]="l">{{ l }}</option>
                    }
                  </select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Code d'événement</mat-label>
                  <input matInput name="eventCodes" [ngModel]="eventCodes()" (ngModelChange)="eventCodes.set($event)" data-cy="logs-event-codes" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Module (logger)</mat-label>
                  <input matInput name="modules" [ngModel]="modules()" (ngModelChange)="modules.set($event)" data-cy="logs-modules" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Référence de trace</mat-label>
                  <input matInput name="traceId" [ngModel]="traceId()" (ngModelChange)="traceId.set($event)" data-cy="logs-trace" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="wide">
                  <mat-label>Texte</mat-label>
                  <input matInput name="text" [ngModel]="text()" (ngModelChange)="text.set($event)" data-cy="logs-text" />
                </mat-form-field>
                <button mat-flat-button type="button" data-cy="logs-search" [disabled]="busy()" (click)="search()">
                  <mat-icon aria-hidden="true">search</mat-icon> Rechercher
                </button>
              </div>

              <div class="saved">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Requêtes sauvegardées</mat-label>
                  <select matNativeControl name="saved" [ngModel]="savedId()" (ngModelChange)="savedId.set($event)" data-cy="logs-saved-select">
                    <option value="">—</option>
                    @for (s of saved(); track s.id) {
                      <option [value]="s.id">{{ s.label }}</option>
                    }
                  </select>
                </mat-form-field>
                <button mat-stroked-button type="button" data-cy="logs-saved-apply" [disabled]="!savedId()" (click)="applySaved()">Appliquer</button>
                <button mat-stroked-button type="button" data-cy="logs-saved-delete" [disabled]="!savedId()" (click)="deleteSaved()">Supprimer</button>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="wide">
                  <mat-label>Nom de la requête</mat-label>
                  <input matInput name="saveLabel" [ngModel]="saveLabel()" (ngModelChange)="saveLabel.set($event)" data-cy="logs-save-label" />
                </mat-form-field>
                <button mat-stroked-button type="button" data-cy="logs-save" [disabled]="!saveLabel().trim()" (click)="saveQuery()">Sauvegarder</button>
              </div>

              @if (busy() || !rows()) {
                <mat-progress-bar mode="indeterminate" data-cy="logs-loading"></mat-progress-bar>
              }

              @if (rows(); as list) {
                <p class="muted" data-cy="logs-count">{{ total() }} résultat(s)</p>
                <table mat-table [dataSource]="list" data-cy="logs-table">
                  <ng-container matColumnDef="timestamp">
                    <th mat-header-cell *matHeaderCellDef>Horodatage</th>
                    <td mat-cell *matCellDef="let r" class="mono">{{ r['@timestamp'] | date: 'dd/MM HH:mm:ss' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="level">
                    <th mat-header-cell *matHeaderCellDef>Niveau</th>
                    <td mat-cell *matCellDef="let r" data-cy="log-level">{{ r['log.level'] }}</td>
                  </ng-container>
                  <ng-container matColumnDef="logger">
                    <th mat-header-cell *matHeaderCellDef>Module</th>
                    <td mat-cell *matCellDef="let r" class="mono">{{ r['log.logger'] ?? '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="message">
                    <th mat-header-cell *matHeaderCellDef>Message</th>
                    <td mat-cell *matCellDef="let r" data-cy="log-message">{{ r['message'] }}</td>
                  </ng-container>
                  <ng-container matColumnDef="code">
                    <th mat-header-cell *matHeaderCellDef>Code</th>
                    <td mat-cell *matCellDef="let r" class="mono">{{ r['event.code'] ?? '—' }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="cols; sticky: true"></tr>
                  <tr mat-row *matRowDef="let row; columns: cols" data-cy="log-row" (click)="selected.set(row)"
                      [class.selected]="row === selected()"></tr>
                </table>
                @if (!list.length) { <p class="muted" data-cy="logs-empty">Aucun log pour ces critères.</p> }
              }

              @if (selected(); as r) {
                <h2 class="detail-title">Détail</h2>
                <pre class="detail" data-cy="log-detail">{{ r | json }}</pre>
              }
            </mat-tab>

            <mat-tab label="Niveaux de log">
              <p class="muted">Surcharges temporaires : chaque niveau revient à sa valeur normale à l'expiration.</p>

              @if (overrides(); as list) {
                <table mat-table [dataSource]="list" data-cy="levels-table">
                  <ng-container matColumnDef="logger">
                    <th mat-header-cell *matHeaderCellDef>Module</th>
                    <td mat-cell *matCellDef="let o" class="mono">{{ o.logger }}</td>
                  </ng-container>
                  <ng-container matColumnDef="level">
                    <th mat-header-cell *matHeaderCellDef>Niveau</th>
                    <td mat-cell *matCellDef="let o" data-cy="level-value">{{ o.level }}</td>
                  </ng-container>
                  <ng-container matColumnDef="expiresAt">
                    <th mat-header-cell *matHeaderCellDef>Expire à</th>
                    <td mat-cell *matCellDef="let o" data-cy="level-expires">{{ o.expiresAt | date: 'dd/MM HH:mm' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="setBy">
                    <th mat-header-cell *matHeaderCellDef>Posée par</th>
                    <td mat-cell *matCellDef="let o">{{ o.setBy?.displayName ?? '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="reason">
                    <th mat-header-cell *matHeaderCellDef>Motif</th>
                    <td mat-cell *matCellDef="let o" class="muted">{{ o.reason }}</td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="levelCols; sticky: true"></tr>
                  <tr mat-row *matRowDef="let row; columns: levelCols" data-cy="level-row"></tr>
                </table>
                @if (!list.length) { <p class="muted" data-cy="levels-empty">Aucune surcharge active.</p> }
              }

              <h2 class="detail-title">Activer temporairement un niveau</h2>
              <div class="filters" data-cy="level-form">
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="wide">
                  <mat-label>Module (logger)</mat-label>
                  <input matInput name="logger" [ngModel]="newLogger()" (ngModelChange)="newLogger.set($event)" data-cy="level-logger" />
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Niveau</mat-label>
                  <select matNativeControl name="level" [ngModel]="newLevel()" (ngModelChange)="newLevel.set($event)" data-cy="level-select">
                    @for (l of overrideLevelOptions; track l) {
                      <option [value]="l">{{ l }}</option>
                    }
                  </select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Durée</mat-label>
                  <select matNativeControl name="duration" [ngModel]="newDuration()" (ngModelChange)="newDuration.set($event)" data-cy="level-duration">
                    @for (d of durations; track d.value) {
                      <option [value]="d.value">{{ d.label }}</option>
                    }
                  </select>
                </mat-form-field>
                <mat-form-field appearance="outline" subscriptSizing="dynamic" class="wide">
                  <mat-label>Motif</mat-label>
                  <input matInput name="reason" [ngModel]="newReason()" (ngModelChange)="newReason.set($event)" data-cy="level-reason" />
                </mat-form-field>
                <button mat-flat-button type="button" data-cy="level-submit" [disabled]="busy() || !levelValid()" (click)="overrideLevel()">
                  Activer
                </button>
              </div>
            </mat-tab>
          </mat-tab-group>
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
      .card { margin-top: var(--ct-space-4); padding: 0; overflow: hidden; }
      .filters { display: flex; flex-wrap: wrap; gap: var(--ct-space-3); align-items: center; margin: var(--ct-space-3) 0; }
      .wide { width: 320px; }
      .saved { display: flex; flex-wrap: wrap; gap: var(--ct-space-3); align-items: center; margin-bottom: var(--ct-space-3); }
      table[mat-table] { width: 100%; background: transparent; }
      tr.mat-mdc-row { cursor: pointer; }
      tr.mat-mdc-row.selected { background: var(--ct-color-muted-bg, transparent); }
      .detail-title { font-size: 1rem; margin: var(--ct-space-4) 0 var(--ct-space-2); }
      .detail { background: var(--ct-color-muted-bg, transparent); padding: var(--ct-space-3); overflow: auto; font-family: var(--ct-font-mono); font-size: 0.82em; }
      .mono { font-family: var(--ct-font-mono); font-size: 0.82em; }
      .muted { color: var(--ct-color-muted); }
    `,
  ],
})
export class LogsPage implements OnInit {
  private readonly service = inject(LogsService);
  private readonly route = inject(ActivatedRoute);
  readonly periods = PERIODS;
  readonly durations = DURATIONS;
  readonly levelOptions = LEVELS;
  readonly overrideLevelOptions = OVERRIDE_LEVELS;
  readonly cols = ['timestamp', 'level', 'logger', 'message', 'code'];
  readonly levelCols = ['logger', 'level', 'expiresAt', 'setBy', 'reason'];

  readonly stream = signal<LogQuery.StreamEnum>('TECHNICAL');
  readonly period = signal('1h');
  readonly levels = signal<LogQuery.LevelsEnum[]>([]);
  readonly eventCodes = signal('');
  readonly modules = signal('');
  readonly traceId = signal('');
  readonly text = signal('');

  readonly rows = signal<LogLine[] | null>(null);
  readonly total = signal(0);
  readonly selected = signal<LogLine | null>(null);
  readonly saved = signal<ListSavedLogQueries200ResponseInner[]>([]);
  readonly savedId = signal('');
  readonly saveLabel = signal('');

  readonly overrides = signal<LogLevelOverride[] | null>(null);
  readonly newLogger = signal('');
  readonly newLevel = signal<LogLevelOverride.LevelEnum>('DEBUG');
  readonly newDuration = signal('PT30M');
  readonly newReason = signal('');

  readonly busy = signal(false);
  readonly error = signal('');
  readonly result = signal('');

  ngOnInit(): void {
    const code = this.route.snapshot.queryParamMap.get('code');
    if (code) this.eventCodes.set(code);
    this.loadSaved();
    this.loadOverrides();
    this.search();
  }

  levelValid(): boolean {
    return this.newLogger().trim().length > 0 && this.newReason().trim().length >= REASON_MIN_LENGTH;
  }

  search(): void {
    this.busy.set(true);
    this.error.set('');
    this.result.set('');
    this.selected.set(null);
    this.service.searchLogs(this.buildQuery()).subscribe({
      next: (page) => {
        this.busy.set(false);
        this.rows.set((page.items ?? []) as LogLine[]);
        this.total.set(page.totalItems ?? 0);
      },
      error: (e: HttpErrorResponse) => this.fail(e, 'Recherche impossible.'),
    });
  }

  applySaved(): void {
    const q = this.saved().find((x) => x.id === this.savedId())?.query;
    if (!q) return;
    this.stream.set(q.stream);
    this.levels.set(q.levels ?? []);
    this.eventCodes.set((q.eventCodes ?? []).join(', '));
    this.modules.set((q.modules ?? []).join(', '));
    this.traceId.set(q.traceId ?? '');
    this.text.set(q.text ?? '');
    this.search();
  }

  deleteSaved(): void {
    const id = this.savedId();
    if (!id) return;
    this.service.deleteSavedLogQuery(id).subscribe({
      next: () => {
        this.saved.update((list) => list.filter((x) => x.id !== id));
        this.savedId.set('');
        this.result.set('Requête supprimée.');
      },
      error: (e: HttpErrorResponse) => this.fail(e, 'Suppression impossible.'),
    });
  }

  saveQuery(): void {
    const label = this.saveLabel().trim();
    if (!label) return;
    this.service.saveLogQuery({ label, query: this.buildQuery() }).subscribe({
      next: (created) => {
        this.saveLabel.set('');
        this.saved.update((list) => [...list, created]);
        this.savedId.set(created.id ?? '');
        this.result.set(`Requête « ${label} » sauvegardée.`);
      },
      error: (e: HttpErrorResponse) => this.fail(e, 'Sauvegarde impossible.'),
    });
  }

  overrideLevel(): void {
    if (!this.levelValid()) return;
    this.busy.set(true);
    this.error.set('');
    this.result.set('');
    this.service.overrideLogLevel({
      logger: this.newLogger().trim(),
      level: this.newLevel(),
      expiresIn: this.newDuration(),
      reason: this.newReason().trim(),
    }).subscribe({
      next: (o) => {
        this.busy.set(false);
        this.result.set(`Niveau ${o.level} actif sur ${o.logger} jusqu’à ${new Date(o.expiresAt ?? '').toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.`);
        this.newReason.set('');
        this.loadOverrides();
      },
      error: (e: HttpErrorResponse) => this.fail(e, 'Activation refusée.'),
    });
  }

  private buildQuery(): LogQuery {
    const now = Date.now();
    const windowMs = PERIODS.find((p) => p.value === this.period())?.ms ?? PERIODS[1].ms;
    const q: LogQuery = {
      stream: this.stream(),
      from: new Date(now - windowMs).toISOString(),
      to: new Date(now).toISOString(),
    };
    const eventCodes = splitList(this.eventCodes());
    const modules = splitList(this.modules());
    if (this.levels().length) q.levels = this.levels();
    if (eventCodes.length) q.eventCodes = eventCodes;
    if (modules.length) q.modules = modules;
    if (this.traceId().trim()) q.traceId = this.traceId().trim();
    if (this.text().trim()) q.text = this.text().trim();
    return q;
  }

  private loadSaved(): void {
    this.service.listSavedLogQueries().subscribe({
      next: (list) => this.saved.set(list),
      error: () => this.error.set('Impossible de charger les requêtes sauvegardées.'),
    });
  }

  private loadOverrides(): void {
    this.service.listLogLevels().subscribe({
      next: (list) => this.overrides.set(list),
      error: () => this.error.set('Impossible de charger les niveaux de log.'),
    });
  }

  private fail(e: HttpErrorResponse, fallback: string): void {
    this.busy.set(false);
    this.error.set(e.status === 403 ? 'Accès refusé : droits insuffisants pour cette action.' : fallback);
  }
}

/** Liste saisie séparée par des virgules, sans éléments vides. */
function splitList(value: string): string[] {
  return value.split(',').map((v) => v.trim()).filter((v) => v.length > 0);
}
