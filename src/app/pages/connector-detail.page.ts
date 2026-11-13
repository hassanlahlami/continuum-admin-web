import { DatePipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  AvailableAction,
  Connector,
  ConnectorExecutionPage,
  ConnectorInput,
  ConnectorMapping,
  ConnectorMappingEntitiesInner,
  ConnectorsService,
  GetCanonicalModel200ResponseInner,
} from '../../../libs/api-clients/operations';

type Tab = 'config' | 'mapping' | 'journal';

/**
 * Connecteur : configuration, mapping et journal (OPS-02). Trois onglets : configuration (secret par référence
 * Vault uniquement), mapping canonique ← source (modèle canonique déclaré par le pack, D35) et journal d'appels
 * (jamais les données) dont une ligne en erreur ouvre la trace (OPS-09). Actions pilotées par `availableActions`.
 * Droits `ops.connector.read` / `manage` appliqués par le serveur. Sélecteurs `data-cy` (D36).
 */
@Component({
  selector: 'ct-connector-detail',
  standalone: true,
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    MatTableModule,
  ],
  template: `
    <section>
      <a routerLink="/connectors" data-cy="cd-back">← Connecteurs</a>
      @if (error()) {
        <p class="error" role="alert" data-cy="cd-error">{{ error() }}</p>
      }
      @if (message()) {
        <p class="ok" role="status" data-cy="cd-message">{{ message() }}</p>
      }
      @if (connector(); as c) {
        <h1 data-cy="cd-title">{{ c.code }}</h1>
        <p class="muted">
          {{ c.kind }}{{ c.erpType ? ' · ' + c.erpType : '' }} · santé
          <span class="health" [attr.data-health]="c.health" data-cy="cd-health">{{ c.health }}</span>
          @if (c.circuitBreaker) { · CB {{ c.circuitBreaker }} }
          @if (!c.enabled) { · désactivé }
          @if (c.lastTestResult; as t) {
            · dernier test : <span data-cy="cd-test-result">{{ t.success ? 'succès' : 'échec' }} ({{ t.latencyMs }} ms) {{ t.message }}</span>
          }
        </p>
        @if (c.availableActions?.length) {
          <div class="actions">
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="dense">
              <mat-label>Motif</mat-label>
              <input matInput name="reason" [ngModel]="reason()" (ngModelChange)="reason.set($event)" data-cy="cd-reason" />
            </mat-form-field>
            @for (a of c.availableActions; track a.code) {
              <button mat-stroked-button type="button" [attr.data-cy]="'cd-action-' + a.code"
                      [disabled]="busy() || (a.requiresComment && !reason().trim())" (click)="run(c, a)">{{ a.label }}</button>
            }
          </div>
        }

        <nav class="tabs" role="tablist">
          <button mat-button type="button" role="tab" data-cy="cd-tab-config" [class.active]="tab() === 'config'" (click)="tab.set('config')">Configuration</button>
          <button mat-button type="button" role="tab" data-cy="cd-tab-mapping" [class.active]="tab() === 'mapping'" (click)="openMapping()">Mapping</button>
          <button mat-button type="button" role="tab" data-cy="cd-tab-journal" [class.active]="tab() === 'journal'" (click)="openJournal()">Journal</button>
        </nav>

        @if (tab() === 'config') {
          <mat-card appearance="outlined"><mat-card-content>
            <form class="grid" (ngSubmit)="saveConfig(c)">
              <mat-form-field appearance="outline"><mat-label>Point d'accès</mat-label>
                <input matInput name="endpoint" [(ngModel)]="form.endpoint" required data-cy="cd-endpoint" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Référence du secret (Vault)</mat-label>
                <input matInput name="secretRef" [(ngModel)]="form.secretRef" data-cy="cd-secret-ref" />
                <mat-hint>Le secret n'est jamais affiché, seulement sa référence.</mat-hint></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Délai (ms)</mat-label>
                <input matInput type="number" name="timeoutMs" [(ngModel)]="form.timeoutMs" min="1" data-cy="cd-timeout" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Tentatives</mat-label>
                <input matInput type="number" name="maxAttempts" [(ngModel)]="form.maxAttempts" min="1" data-cy="cd-attempts" /></mat-form-field>
              <div><button mat-flat-button color="primary" type="submit" data-cy="cd-save" [disabled]="busy() || !form.endpoint.trim()">Enregistrer</button></div>
            </form>
          </mat-card-content></mat-card>
        }

        @if (tab() === 'mapping') {
          @if (mapping(); as m) {
            @if (canonical()) {
              @for (e of m.entities; track e.canonicalEntity) {
                <mat-card appearance="outlined" class="entity" data-cy="cd-mapping-entity">
                  <mat-card-content>
                    <h3>{{ entityLabel(e.canonicalEntity) }} <span class="muted">← {{ e.source || '—' }}</span></h3>
                    <table class="map">
                      <thead><tr><th>Champ canonique</th><th>Champ source</th><th>Transformation</th></tr></thead>
                      <tbody>
                        @for (f of e.fields; track f.canonicalField) {
                          <tr data-cy="cd-mapping-field">
                            <td>{{ f.canonicalField }}@if (isRequired(e.canonicalEntity, f.canonicalField)) { <span class="req" title="Obligatoire">*</span> }</td>
                            <td><input class="ct-input" [name]="'src-' + f.canonicalField" [ngModel]="f.sourceField" (ngModelChange)="setSource(f, $event)" data-cy="cd-mapping-source" /></td>
                            <td><input class="ct-input" [name]="'tr-' + f.canonicalField" [ngModel]="f.transform" (ngModelChange)="setTransform(f, $event)" data-cy="cd-mapping-transform" /></td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </mat-card-content>
                </mat-card>
              }
              @if (missing().length) {
                <p class="error" role="alert" data-cy="cd-mapping-missing">Champs obligatoires non reliés : {{ missing().join(', ') }}</p>
              }
              <button mat-flat-button color="primary" type="button" data-cy="cd-mapping-save"
                      [disabled]="busy() || missing().length > 0" (click)="saveMapping()">Enregistrer le mapping</button>
            } @else {
              <mat-progress-bar mode="indeterminate"></mat-progress-bar>
            }
          } @else {
            <mat-progress-bar mode="indeterminate" data-cy="cd-mapping-loading"></mat-progress-bar>
          }
        }

        @if (tab() === 'journal') {
          @if (executions(); as ex) {
            <mat-card appearance="outlined" class="table-card">
              <table mat-table [dataSource]="ex.items" data-cy="cd-executions">
                <ng-container matColumnDef="at"><th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let e">{{ e.at | date: 'dd/MM/yyyy HH:mm:ss' }}</td></ng-container>
                <ng-container matColumnDef="operation"><th mat-header-cell *matHeaderCellDef>Opération</th>
                  <td mat-cell *matCellDef="let e">{{ e.operation }}</td></ng-container>
                <ng-container matColumnDef="outcome"><th mat-header-cell *matHeaderCellDef>Résultat</th>
                  <td mat-cell *matCellDef="let e">{{ e.outcome }}</td></ng-container>
                <ng-container matColumnDef="durationMs"><th mat-header-cell *matHeaderCellDef>Durée (ms)</th>
                  <td mat-cell *matCellDef="let e">{{ e.durationMs }}</td></ng-container>
                <ng-container matColumnDef="records"><th mat-header-cell *matHeaderCellDef>Volume</th>
                  <td mat-cell *matCellDef="let e">{{ e.records }}</td></ng-container>
                <ng-container matColumnDef="eventCode"><th mat-header-cell *matHeaderCellDef>Code</th>
                  <td mat-cell *matCellDef="let e"><code>{{ e.eventCode ?? '—' }}</code></td></ng-container>
                <ng-container matColumnDef="trace"><th mat-header-cell *matHeaderCellDef>Trace</th>
                  <td mat-cell *matCellDef="let e">
                    @if (e.traceId) { <a [routerLink]="['/traces', e.traceId]" data-cy="cd-trace-link">Ouvrir la trace</a> }
                  </td></ng-container>
                <tr mat-header-row *matHeaderRowDef="exCols"></tr>
                <tr mat-row *matRowDef="let e; columns: exCols" data-cy="cd-execution-row"></tr>
              </table>
              @if (!ex.items.length) { <p class="muted" data-cy="cd-executions-empty">Aucune exécution.</p> }
            </mat-card>
          } @else {
            <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          }
        }
      } @else if (!error()) {
        <mat-progress-bar mode="indeterminate"></mat-progress-bar>
      }
    </section>
  `,
  styles: [
    `
      .muted { color: var(--ct-color-muted); }
      .error { color: var(--ct-red-700); }
      .ok { color: var(--ct-green-600); font-weight: 600; }
      .health { font-weight: 600; }
      .health[data-health='UP'] { color: var(--ct-green-600); }
      .health[data-health='DOWN'] { color: var(--ct-red-700); }
      .actions { display: flex; flex-wrap: wrap; gap: var(--ct-space-3); align-items: center; margin: var(--ct-space-3) 0; }
      .actions .dense { width: 240px; }
      .tabs { display: flex; gap: var(--ct-space-2); margin: var(--ct-space-4) 0 var(--ct-space-3); border-bottom: 1px solid var(--ct-color-border); }
      .tabs .active { font-weight: 700; color: var(--ct-color-primary); }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: var(--ct-space-3); }
      .entity { margin-bottom: var(--ct-space-3); }
      table.map { width: 100%; border-collapse: collapse; }
      table.map th, table.map td { text-align: left; padding: var(--ct-space-2); }
      .ct-input { width: 100%; padding: var(--ct-space-2); border: 1px solid var(--ct-color-border); border-radius: var(--ct-radius-sm); font: inherit; }
      .req { color: var(--ct-red-700); margin-left: var(--ct-space-1); }
      .table-card { padding: 0; overflow: hidden; }
      table[mat-table] { width: 100%; background: transparent; }
      code { font-family: var(--ct-font-mono); font-size: 0.82em; }
    `,
  ],
})
export class ConnectorDetailPage implements OnInit {
  private readonly service = inject(ConnectorsService);
  private readonly route = inject(ActivatedRoute);
  private id = '';
  readonly exCols = ['at', 'operation', 'outcome', 'durationMs', 'records', 'eventCode', 'trace'];
  readonly connector = signal<Connector | null>(null);
  readonly tab = signal<Tab>('config');
  readonly mapping = signal<ConnectorMapping | null>(null);
  readonly canonical = signal<GetCanonicalModel200ResponseInner[] | null>(null);
  readonly executions = signal<ConnectorExecutionPage | null>(null);
  readonly reason = signal('');
  readonly busy = signal(false);
  readonly error = signal('');
  readonly message = signal('');
  form = { endpoint: '', secretRef: '', timeoutMs: 0, maxAttempts: 0 };

  /** Champs obligatoires du modèle canonique sans champ source, pour les entités mappées. */
  readonly missing = computed(() => {
    const m = this.mapping();
    const model = this.canonical();
    if (!m || !model) return [];
    const out: string[] = [];
    for (const e of m.entities) {
      const def = model.find((x) => x.entity === e.canonicalEntity);
      for (const f of def?.fields ?? []) {
        if (f.required && !e.fields.some((x) => x.canonicalField === f.name && x.sourceField?.trim())) out.push(`${e.canonicalEntity}.${f.name}`);
      }
    }
    return out;
  });

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('connectorId') ?? '';
    this.service.getConnector(this.id).subscribe({
      next: (c) => this.apply(c),
      error: () => this.error.set('Connecteur introuvable ou accès refusé.'),
    });
  }

  entityLabel(entity: string): string {
    return this.canonical()?.find((x) => x.entity === entity)?.label ?? entity;
  }

  isRequired(entity: string, field: string): boolean {
    return !!this.canonical()?.find((x) => x.entity === entity)?.fields.find((f) => f.name === field)?.required;
  }

  /** Modifie le champ source en renouvelant le signal, pour recalculer les champs obligatoires manquants. */
  setSource(f: { sourceField: string }, value: string): void {
    f.sourceField = value;
    this.mapping.update((m) => (m ? { ...m } : m));
  }

  setTransform(f: { transform?: string }, value: string): void {
    f.transform = value;
  }

  openMapping(): void {
    this.tab.set('mapping');
    if (!this.mapping()) {
      this.service.getConnectorMapping(this.id).subscribe({
        next: (m) => this.mapping.set(m),
        error: () => this.error.set('Impossible de charger le mapping.'),
      });
    }
    if (!this.canonical()) {
      this.service.getCanonicalModel().subscribe({
        next: (m) => this.canonical.set(m),
        error: () => this.error.set('Impossible de charger le modèle canonique.'),
      });
    }
  }

  openJournal(): void {
    this.tab.set('journal');
    this.service.listConnectorExecutions(this.id).subscribe({
      next: (p) => this.executions.set(p),
      error: () => this.error.set("Impossible de charger le journal d'exécution."),
    });
  }

  saveConfig(c: Connector): void {
    const input: ConnectorInput = {
      version: c.version, code: c.code, kind: c.kind, erpType: c.erpType, entityId: c.entityId,
      endpoint: this.form.endpoint.trim(), secretRef: this.form.secretRef.trim() || undefined,
      timeoutMs: this.form.timeoutMs || undefined, retry: { ...c.retry, maxAttempts: this.form.maxAttempts || undefined },
    };
    this.busy.set(true);
    this.reset();
    this.service.updateConnector(this.id, input).subscribe({
      next: (u) => { this.busy.set(false); this.apply(u); this.message.set('Configuration enregistrée.'); },
      error: () => { this.busy.set(false); this.error.set('Enregistrement refusé ou en conflit de version.'); },
    });
  }

  saveMapping(): void {
    const m = this.mapping();
    if (!m || this.missing().length) return;
    const entities: ConnectorMappingEntitiesInner[] = m.entities.map((e) => ({
      ...e,
      fields: e.fields.map((f) => ({ ...f, transform: f.transform?.trim() || undefined })),
    }));
    this.busy.set(true);
    this.reset();
    this.service.updateConnectorMapping(this.id, { version: m.version, entities }).subscribe({
      next: (u) => { this.busy.set(false); this.mapping.set(u); this.message.set('Mapping enregistré.'); },
      error: () => { this.busy.set(false); this.error.set('Mapping refusé ou en conflit de version.'); },
    });
  }

  run(c: Connector, a: AvailableAction): void {
    if (a.confirmationMessage && !window.confirm(a.confirmationMessage)) return;
    this.busy.set(true);
    this.reset();
    this.service.performConnectorAction(c.id, a.code, { version: c.version ?? 0, comment: this.reason().trim() || undefined }).subscribe({
      next: (u) => { this.busy.set(false); this.reason.set(''); this.apply(u); },
      error: () => { this.busy.set(false); this.error.set(`Action « ${a.label} » refusée ou en échec.`); },
    });
  }

  private reset(): void {
    this.error.set('');
    this.message.set('');
  }

  private apply(c: Connector): void {
    this.connector.set(c);
    this.form = { endpoint: c.endpoint, secretRef: c.secretRef ?? '', timeoutMs: c.timeoutMs ?? 0, maxAttempts: c.retry?.maxAttempts ?? 0 };
  }
}
