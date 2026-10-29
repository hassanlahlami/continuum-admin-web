import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { MatTabsModule } from '@angular/material/tabs';
import { AlertRule, AlertsService, ErrorGroup } from '../../../libs/api-clients/operations';

type Channel = NonNullable<AlertRule['channels']>[number];

const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'IN_APP', label: 'In-app' },
  { value: 'EMAIL', label: 'E-mail' },
  { value: 'SIEM', label: 'SIEM' },
];

/** Fenêtres proposées (ISO-8601 `PT…`). */
const WINDOWS: { value: string; label: string }[] = [
  { value: 'PT5M', label: '5 minutes' },
  { value: 'PT10M', label: '10 minutes' },
  { value: 'PT1H', label: '1 heure' },
  { value: 'PT24H', label: '24 heures' },
];

/** Période d'agrégation des erreurs : fenêtre glissante jusqu'à maintenant. */
const PERIODS: { value: string; label: string; ms: number }[] = [
  { value: '1h', label: 'Dernière heure', ms: 60 * 60_000 },
  { value: '24h', label: '24 dernières heures', ms: 24 * 60 * 60_000 },
  { value: '7d', label: '7 derniers jours', ms: 7 * 24 * 60 * 60_000 },
];

/**
 * Erreurs et alertes (OPS-10, §10.4) : onglet Erreurs (groupes par code d'événement, tendance, instances, runbook,
 * lien vers OPS-08 filtré sur le code) et onglet Règles d'alerte (liste, création, modification, suppression).
 * Les droits (`admin.logs.tech.read`, `admin.alerts.manage`) sont appliqués par le serveur : un 403 est affiché
 * par onglet. Sélecteurs `data-cy` (D36).
 */
@Component({
  selector: 'ct-errors',
  standalone: true,
  imports: [
    DatePipe, FormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule,
    MatInputModule, MatProgressBarModule, MatTableModule, MatTabsModule,
  ],
  template: `
    <section>
      <header class="page-head"><h1>Erreurs et alertes</h1></header>
      <p class="page-sub">Erreurs regroupées par code d'événement, procédure à suivre et règles d'alerte.</p>

      @if (result()) { <p class="result" role="status" data-cy="errors-result">{{ result() }}</p> }

      <mat-card appearance="outlined" class="card">
        <mat-card-content>
          <mat-tab-group>
            <mat-tab label="Erreurs">
              <div class="filters">
                <mat-form-field appearance="outline" subscriptSizing="dynamic">
                  <mat-label>Période</mat-label>
                  <select matNativeControl name="period" [ngModel]="period()" (ngModelChange)="period.set($event); loadGroups()" data-cy="errors-period">
                    @for (p of periods; track p.value) { <option [value]="p.value">{{ p.label }}</option> }
                  </select>
                </mat-form-field>
              </div>
              @if (groupsError()) { <p class="error" role="alert" data-cy="errors-error">{{ groupsError() }}</p> }
              @if (groupsLoading()) { <mat-progress-bar mode="indeterminate" data-cy="errors-loading"></mat-progress-bar> }
              @if (groups(); as list) {
                <table mat-table [dataSource]="list" data-cy="errors-table">
                  <ng-container matColumnDef="code">
                    <th mat-header-cell *matHeaderCellDef>Code</th>
                    <td mat-cell *matCellDef="let g" class="mono" data-cy="error-code">{{ g.eventCode }}</td>
                  </ng-container>
                  <ng-container matColumnDef="label">
                    <th mat-header-cell *matHeaderCellDef>Libellé</th>
                    <td mat-cell *matCellDef="let g">{{ g.label ?? '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="level">
                    <th mat-header-cell *matHeaderCellDef>Niveau</th>
                    <td mat-cell *matCellDef="let g"><span class="level" [class.warn]="g.level === 'WARN'" data-cy="error-level">{{ g.level ?? '—' }}</span></td>
                  </ng-container>
                  <ng-container matColumnDef="occurrences">
                    <th mat-header-cell *matHeaderCellDef>Occurrences</th>
                    <td mat-cell *matCellDef="let g" data-cy="error-occurrences">{{ g.occurrences }}</td>
                  </ng-container>
                  <ng-container matColumnDef="trend">
                    <th mat-header-cell *matHeaderCellDef>Tendance</th>
                    <td mat-cell *matCellDef="let g" data-cy="error-trend">{{ trend(g) }}</td>
                  </ng-container>
                  <ng-container matColumnDef="seen">
                    <th mat-header-cell *matHeaderCellDef>Première / dernière</th>
                    <td mat-cell *matCellDef="let g" class="mono">{{ g.firstSeenAt | date: 'dd/MM HH:mm' }} → {{ g.lastSeenAt | date: 'dd/MM HH:mm' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="nodes">
                    <th mat-header-cell *matHeaderCellDef>Instances</th>
                    <td mat-cell *matCellDef="let g" class="mono">{{ (g.nodes ?? []).join(', ') || '—' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let g">
                      <button mat-stroked-button type="button" data-cy="error-runbook-toggle"
                              [disabled]="!g.runbook" [attr.aria-expanded]="openCode() === g.eventCode"
                              (click)="toggleRunbook(g.eventCode)">Runbook</button>
                      <a mat-stroked-button data-cy="error-logs-link" routerLink="/logs" [queryParams]="{ code: g.eventCode }">Voir les logs</a>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="groupCols; sticky: true"></tr>
                  <tr mat-row *matRowDef="let row; columns: groupCols" data-cy="error-row"></tr>
                </table>
                @if (!list.length) { <p class="muted" data-cy="errors-empty">Aucune erreur sur la période.</p> }
                @for (g of list; track g.eventCode) {
                  @if (openCode() === g.eventCode && g.runbook) {
                    <div class="runbook" data-cy="error-runbook">
                      <h2 class="detail-title">Procédure — {{ g.eventCode }}</h2>
                      <pre>{{ g.runbook }}</pre>
                    </div>
                  }
                }
              }
            </mat-tab>

            <mat-tab label="Règles d'alerte">
              @if (rulesError()) { <p class="error" role="alert" data-cy="rules-error">{{ rulesError() }}</p> }
              @if (rules(); as list) {
                <table mat-table [dataSource]="list" data-cy="rules-table">
                  <ng-container matColumnDef="label">
                    <th mat-header-cell *matHeaderCellDef>Règle</th>
                    <td mat-cell *matCellDef="let r" data-cy="rule-label">{{ r.label }}</td>
                  </ng-container>
                  <ng-container matColumnDef="code">
                    <th mat-header-cell *matHeaderCellDef>Code</th>
                    <td mat-cell *matCellDef="let r" class="mono">{{ r.eventCode }}</td>
                  </ng-container>
                  <ng-container matColumnDef="threshold">
                    <th mat-header-cell *matHeaderCellDef>Seuil</th>
                    <td mat-cell *matCellDef="let r">{{ r.threshold }}</td>
                  </ng-container>
                  <ng-container matColumnDef="window">
                    <th mat-header-cell *matHeaderCellDef>Fenêtre</th>
                    <td mat-cell *matCellDef="let r" class="mono">{{ r.window }}</td>
                  </ng-container>
                  <ng-container matColumnDef="channels">
                    <th mat-header-cell *matHeaderCellDef>Canaux</th>
                    <td mat-cell *matCellDef="let r">{{ channelLabels(r) }}</td>
                  </ng-container>
                  <ng-container matColumnDef="enabled">
                    <th mat-header-cell *matHeaderCellDef>Actif</th>
                    <td mat-cell *matCellDef="let r" data-cy="rule-enabled">{{ r.enabled ? 'Oui' : 'Non' }}</td>
                  </ng-container>
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let r">
                      <button mat-stroked-button type="button" data-cy="rule-edit" (click)="edit(r)">Modifier</button>
                      <button mat-stroked-button type="button" data-cy="rule-delete" (click)="remove(r)">Supprimer</button>
                    </td>
                  </ng-container>
                  <tr mat-header-row *matHeaderRowDef="ruleCols; sticky: true"></tr>
                  <tr mat-row *matRowDef="let row; columns: ruleCols" data-cy="rule-row"></tr>
                </table>
                @if (!list.length) { <p class="muted" data-cy="rules-empty">Aucune règle d'alerte.</p> }

                <h2 class="detail-title">{{ editingId() ? 'Modifier la règle' : 'Nouvelle règle' }}</h2>
                <div class="filters" data-cy="rule-form">
                  <mat-form-field appearance="outline" subscriptSizing="dynamic" class="wide">
                    <mat-label>Libellé</mat-label>
                    <input matInput name="label" [ngModel]="label()" (ngModelChange)="label.set($event)" data-cy="rule-form-label" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Code d'événement</mat-label>
                    <input matInput name="eventCode" [ngModel]="eventCode()" (ngModelChange)="eventCode.set($event)" data-cy="rule-form-code" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Seuil</mat-label>
                    <input matInput type="number" min="1" name="threshold" [ngModel]="threshold()" (ngModelChange)="threshold.set($event)" data-cy="rule-form-threshold" />
                  </mat-form-field>
                  <mat-form-field appearance="outline" subscriptSizing="dynamic">
                    <mat-label>Fenêtre</mat-label>
                    <select matNativeControl name="window" [ngModel]="window()" (ngModelChange)="window.set($event)" data-cy="rule-form-window">
                      @for (w of windows; track w.value) { <option [value]="w.value">{{ w.label }}</option> }
                    </select>
                  </mat-form-field>
                  <fieldset class="channels">
                    <legend>Canaux</legend>
                    @for (c of channelOptions; track c.value) {
                      <label><input type="checkbox" [checked]="channels().includes(c.value)" (change)="toggleChannel(c.value)" [attr.data-cy]="'rule-form-channel-' + c.value" /> {{ c.label }}</label>
                    }
                  </fieldset>
                  <label><input type="checkbox" [checked]="enabled()" (change)="enabled.set(!enabled())" data-cy="rule-form-enabled" /> Actif</label>
                  <button mat-flat-button type="button" data-cy="rule-form-submit" [disabled]="busy() || !valid()" (click)="save()">
                    {{ editingId() ? 'Enregistrer' : 'Créer' }}
                  </button>
                  @if (editingId()) {
                    <button mat-stroked-button type="button" data-cy="rule-form-cancel" (click)="reset()">Annuler</button>
                  }
                </div>
              }
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
      .channels { display: flex; gap: var(--ct-space-3); border: 0; padding: 0; margin: 0; }
      .channels legend { color: var(--ct-color-muted); font-size: 0.82em; }
      table[mat-table] { width: 100%; background: transparent; }
      .detail-title { font-size: 1rem; margin: var(--ct-space-4) 0 var(--ct-space-2); }
      .runbook pre { white-space: pre-wrap; background: var(--ct-color-muted-bg, transparent); padding: var(--ct-space-3); font-family: var(--ct-font-mono); font-size: 0.82em; }
      .level { color: var(--ct-red-700); font-weight: 600; }
      .level.warn { color: var(--ct-amber-700); }
      .mono { font-family: var(--ct-font-mono); font-size: 0.82em; }
      .muted { color: var(--ct-color-muted); }
    `,
  ],
})
export class ErrorsPage implements OnInit {
  private readonly service = inject(AlertsService);
  readonly periods = PERIODS;
  readonly windows = WINDOWS;
  readonly channelOptions = CHANNELS;
  readonly groupCols = ['code', 'label', 'level', 'occurrences', 'trend', 'seen', 'nodes', 'actions'];
  readonly ruleCols = ['label', 'code', 'threshold', 'window', 'channels', 'enabled', 'actions'];

  readonly period = signal('24h');
  readonly groups = signal<ErrorGroup[] | null>(null);
  readonly groupsLoading = signal(false);
  readonly groupsError = signal('');
  readonly openCode = signal('');

  readonly rules = signal<AlertRule[] | null>(null);
  readonly rulesError = signal('');

  readonly editingId = signal('');
  readonly label = signal('');
  readonly eventCode = signal('');
  readonly threshold = signal<number | null>(5);
  readonly window = signal('PT10M');
  readonly channels = signal<Channel[]>(['IN_APP']);
  readonly enabled = signal(true);

  readonly busy = signal(false);
  readonly result = signal('');

  ngOnInit(): void {
    this.loadGroups();
    this.loadRules();
  }

  loadGroups(): void {
    const ms = PERIODS.find((p) => p.value === this.period())?.ms ?? PERIODS[1].ms;
    const now = Date.now();
    this.groupsLoading.set(true);
    this.groupsError.set('');
    this.service.listErrorGroups(new Date(now - ms).toISOString(), new Date(now).toISOString()).subscribe({
      next: (list) => { this.groupsLoading.set(false); this.groups.set(list); },
      error: (e: HttpErrorResponse) => {
        this.groupsLoading.set(false);
        this.groups.set(null);
        this.groupsError.set(e.status === 403 ? 'Accès refusé : droit admin.logs.tech.read requis.' : 'Impossible de charger les erreurs.');
      },
    });
  }

  loadRules(): void {
    this.service.listAlertRules().subscribe({
      next: (list) => { this.rules.set(list); this.rulesError.set(''); },
      error: (e: HttpErrorResponse) => {
        this.rules.set(null);
        this.rulesError.set(e.status === 403 ? 'Accès refusé : droit admin.alerts.manage requis.' : 'Impossible de charger les règles d’alerte.');
      },
    });
  }

  trend(g: ErrorGroup): string {
    const t = g.trend ?? [];
    if (t.length < 2) return '—';
    const d = (t[t.length - 1].count ?? 0) - (t[t.length - 2].count ?? 0);
    return d > 0 ? `↑ +${d}` : d < 0 ? `↓ ${d}` : '→ stable';
  }

  toggleRunbook(code: string): void {
    this.openCode.set(this.openCode() === code ? '' : code);
  }

  channelLabels(r: AlertRule): string {
    return r.channels.map((c) => CHANNELS.find((x) => x.value === c)?.label ?? c).join(', ');
  }

  toggleChannel(c: Channel): void {
    this.channels.update((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  }

  valid(): boolean {
    return !!this.label().trim() && !!this.eventCode().trim() && (this.threshold() ?? 0) >= 1 && this.channels().length > 0;
  }

  edit(r: AlertRule): void {
    this.editingId.set(r.id ?? '');
    this.label.set(r.label);
    this.eventCode.set(r.eventCode);
    this.threshold.set(r.threshold);
    this.window.set(r.window);
    this.channels.set([...r.channels]);
    this.enabled.set(r.enabled ?? true);
  }

  reset(): void {
    this.editingId.set('');
    this.label.set('');
    this.eventCode.set('');
    this.threshold.set(5);
    this.window.set('PT10M');
    this.channels.set(['IN_APP']);
    this.enabled.set(true);
  }

  save(): void {
    if (!this.valid()) return;
    const body: AlertRule = {
      label: this.label().trim(), eventCode: this.eventCode().trim(), threshold: Number(this.threshold()),
      window: this.window(), channels: this.channels(), enabled: this.enabled(),
    };
    const id = this.editingId();
    this.busy.set(true);
    this.result.set('');
    (id ? this.service.updateAlertRule(id, body) : this.service.createAlertRule(body)).subscribe({
      next: (r) => {
        this.busy.set(false);
        this.result.set(`Règle « ${r.label} » ${id ? 'enregistrée' : 'créée'}.`);
        this.reset();
        this.loadRules();
      },
      error: (e: HttpErrorResponse) => this.fail(e, 'Enregistrement impossible.'),
    });
  }

  remove(r: AlertRule): void {
    if (!r.id) return;
    this.result.set('');
    this.service.deleteAlertRule(r.id).subscribe({
      next: () => {
        this.result.set(`Règle « ${r.label} » supprimée.`);
        this.loadRules();
      },
      error: (e: HttpErrorResponse) => this.fail(e, 'Suppression impossible.'),
    });
  }

  private fail(e: HttpErrorResponse, fallback: string): void {
    this.busy.set(false);
    this.rulesError.set(e.status === 403 ? 'Accès refusé : droit admin.alerts.manage requis.' : fallback);
  }
}
