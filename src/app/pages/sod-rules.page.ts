import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { ChangeResult, ListSodConflicts200ResponseInner, SodRule, SodService } from '../../../libs/api-clients/admin-iam';

/**
 * Règles de séparation des tâches (ADM-11, §2.1) — liste + éditeur des règles (`listSodRules`, `createSodRule`,
 * `updateSodRule`, `deleteSodRule`) et onglet « Conflits actuels » (`listSodConflicts`), via le client généré (D32).
 * Le front n'enforce rien : refus (403), conflit de version (409), validation (422) et double validation de la
 * suppression sont ceux décidés par le serveur.
 */
@Component({
  selector: 'ct-sod-rules',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatProgressBarModule, MatTabsModule],
  template: `
    <section>
      <header class="page-head"><h1>Séparation des tâches</h1></header>
      <p class="page-sub">Cumuls interdits (statiques) et règles « pas sur le même objet » (dynamiques), avec les conflits constatés sur les affectations actuelles.</p>

      @if (message(); as msg) { <p class="ok" role="status" data-cy="sod-message">{{ msg }}</p> }
      @if (error(); as code) { <p class="err" role="alert" data-cy="sod-error">{{ errorHint(code) }}</p> }
      @if (loading()) { <mat-progress-bar mode="indeterminate" data-cy="sod-loading"></mat-progress-bar> }

      <mat-tab-group>
        <mat-tab label="Règles">
          <div class="tab">
            <div class="actions">
              <button mat-flat-button type="button" data-cy="sod-new" (click)="startNew()">Nouvelle règle</button>
            </div>

            @if (draft(); as d) {
              <mat-card appearance="outlined" class="form" data-cy="sod-form">
                <mat-card-content>
                  <div class="field"><label for="sod-fa">Fonctionnalité A</label>
                    <input id="sod-fa" name="featureA" data-cy="sod-feature-a" [(ngModel)]="d.featureA" required /></div>
                  <div class="field"><label for="sod-fb">Fonctionnalité B</label>
                    <input id="sod-fb" name="featureB" data-cy="sod-feature-b" [(ngModel)]="d.featureB" required /></div>
                  <div class="field"><label for="sod-type">Type</label>
                    <select id="sod-type" name="type" data-cy="sod-type" [(ngModel)]="d.type">
                      <option value="STATIC">Statique — cumul interdit</option>
                      <option value="DYNAMIC">Dynamique — pas sur le même objet</option>
                    </select></div>
                  <div class="field"><label for="sod-sev">Sévérité</label>
                    <select id="sod-sev" name="severity" data-cy="sod-severity" [(ngModel)]="d.severity">
                      <option value="BLOCK">Bloquer</option>
                      <option value="WARN">Avertir</option>
                    </select></div>
                  <div class="field"><label for="sod-desc">Description</label>
                    <input id="sod-desc" name="description" data-cy="sod-description" [(ngModel)]="d.description" /></div>
                  <div class="actions">
                    <button mat-flat-button type="button" data-cy="sod-save" [disabled]="saving() || !d.featureA || !d.featureB" (click)="save()">Enregistrer</button>
                    <button mat-button type="button" data-cy="sod-cancel" (click)="draft.set(null)">Annuler</button>
                  </div>
                </mat-card-content>
              </mat-card>
            }

            @if (rules().length) {
              <mat-card appearance="outlined">
                <mat-card-content class="scroll">
                  <table data-cy="sod-rules">
                    <thead><tr>
                      <th scope="col">Fonctionnalité A</th><th scope="col">Fonctionnalité B</th><th scope="col">Type</th>
                      <th scope="col">Sévérité</th><th scope="col">Description</th><th scope="col"><span class="sr-only">Actions</span></th>
                    </tr></thead>
                    <tbody>
                      @for (r of rules(); track r.id) {
                        <tr data-cy="sod-rule">
                          <td>{{ r.featureA }}@if (r.fromPack) { <span class="badge" data-cy="sod-pack-badge">Pack</span> }</td>
                          <td>{{ r.featureB }}</td>
                          <td>{{ r.type === 'STATIC' ? 'Statique' : 'Dynamique' }}</td>
                          <td>{{ r.severity === 'BLOCK' ? 'Bloquer' : 'Avertir' }}</td>
                          <td>{{ r.description }}</td>
                          <td class="row-actions">
                            @if (can(r, 'edit')) {
                              <button mat-button type="button" data-cy="sod-edit" (click)="startEdit(r)">Modifier</button>
                            }
                            @if (can(r, 'delete')) {
                              <button mat-button type="button" data-cy="sod-delete" (click)="remove(r)">Supprimer</button>
                            }
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </mat-card-content>
              </mat-card>
            } @else if (!loading() && !error()) {
              <p class="muted" data-cy="sod-empty">Aucune règle.</p>
            }
          </div>
        </mat-tab>
        <mat-tab label="Conflits actuels">
          <div class="tab">
            @if (conflicts().length) {
              <mat-card appearance="outlined">
                <mat-card-content class="scroll">
                  <table data-cy="sod-conflicts">
                    <thead><tr>
                      <th scope="col">Utilisateur</th><th scope="col">Règle</th><th scope="col">Affectations concernées</th>
                    </tr></thead>
                    <tbody>
                      @for (c of conflicts(); track $index) {
                        <tr data-cy="sod-conflict">
                          <td>{{ c.user?.displayName }}@if (c.user?.positionLabel) { <span class="muted"> — {{ c.user?.positionLabel }}</span> }</td>
                          <td>{{ c.rule?.featureA }} / {{ c.rule?.featureB }}</td>
                          <td>{{ c.viaAssignments?.length ?? 0 }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                </mat-card-content>
              </mat-card>
            } @else if (!loading()) {
              <p class="muted" data-cy="sod-conflicts-empty">Aucun conflit constaté.</p>
            }
          </div>
        </mat-tab>
      </mat-tab-group>
    </section>
  `,
  styles: [
    `
      .page-sub { color: var(--ct-color-muted); margin-top: 0; max-width: 72ch; }
      .tab { padding-top: var(--ct-space-3); }
      .scroll { overflow-x: auto; }
      table { border-collapse: collapse; width: 100%; }
      th, td { padding: var(--ct-space-2) var(--ct-space-3); border-bottom: 1px solid var(--ct-color-border); text-align: start; }
      thead th { background: var(--ct-color-surface); }
      .actions { margin-bottom: var(--ct-space-2); display: flex; gap: var(--ct-space-2); }
      .form { margin-bottom: var(--ct-space-3); }
      .field { display: flex; flex-direction: column; gap: var(--ct-space-1); margin-bottom: var(--ct-space-2); max-width: 32rem; }
      .field input, .field select { padding: var(--ct-space-2); border: 1px solid var(--ct-color-border); border-radius: var(--ct-radius-sm); font: inherit; }
      .row-actions { white-space: nowrap; }
      .badge { margin-inline-start: var(--ct-space-1); padding: 0 var(--ct-space-1); border: 1px solid var(--ct-color-border); border-radius: var(--ct-radius-sm); color: var(--ct-color-muted); font-size: 0.75rem; }
      .ok { color: var(--ct-green-600); }
      .err { color: var(--ct-red-700); }
      .muted { color: var(--ct-color-muted); }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `,
  ],
})
export class SodRulesPage implements OnInit {
  private readonly sod = inject(SodService);

  readonly rules = signal<SodRule[]>([]);
  readonly conflicts = signal<ListSodConflicts200ResponseInner[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<number | null>(null);
  /** Règle en cours d'édition (copie) ; absente → formulaire fermé. */
  readonly draft = signal<SodRule | null>(null);

  ngOnInit(): void {
    this.load();
  }

  startNew(): void {
    this.clear();
    this.draft.set({ featureA: '', featureB: '', type: SodRule.TypeEnum.Static, severity: SodRule.SeverityEnum.Block, description: '' });
  }

  startEdit(r: SodRule): void {
    this.clear();
    this.draft.set({ ...r });
  }

  save(): void {
    const d = this.draft();
    if (!d) return;
    this.saving.set(true);
    this.clear();
    // `fromPack` et `availableActions` sont en lecture seule côté serveur : on ne les renvoie pas.
    const { fromPack, availableActions, ...payload } = d;
    const call = d.id ? this.sod.updateSodRule(d.id, payload) : this.sod.createSodRule(payload);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.draft.set(null);
        this.message.set('Règle enregistrée.');
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(e.status);
        if (e.status === 409) { this.draft.set(null); this.load(); }
      },
    });
  }

  remove(r: SodRule): void {
    if (!r.id) return;
    this.clear();
    this.sod.deleteSodRule(r.id).subscribe({
      next: (res) => {
        this.message.set(res.state === ChangeResult.StateEnum.PendingApproval
          ? 'Suppression soumise à double validation.'
          : 'Règle supprimée.');
        this.load();
      },
      error: (e: HttpErrorResponse) => this.error.set(e.status),
    });
  }

  /** Action permise sur la règle, telle que décidée par le serveur (`availableActions`) : le front n'infère rien. */
  can(rule: SodRule, code: string): boolean {
    return !!rule.availableActions?.some((a) => a.code === code);
  }

  errorHint(code: number): string {
    if (code === 403) return 'Accès refusé par le serveur (droit insuffisant).';
    if (code === 409) return 'La règle a été modifiée entre-temps : la liste a été rechargée, refaites votre modification.';
    if (code === 422) return 'Règle invalide : vérifiez les deux fonctionnalités.';
    return 'Impossible de charger ou d’enregistrer les règles.';
  }

  private clear(): void {
    this.message.set(null);
    this.error.set(null);
  }

  private load(): void {
    this.loading.set(true);
    this.sod.listSodRules().subscribe({
      next: (r) => { this.rules.set(r); this.loading.set(false); },
      error: (e: HttpErrorResponse) => { this.rules.set([]); this.error.set(e.status); this.loading.set(false); },
    });
    this.sod.listSodConflicts().subscribe({
      next: (c) => this.conflicts.set(c),
      error: () => this.conflicts.set([]),
    });
  }
}
