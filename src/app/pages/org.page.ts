import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { OrgService, OrgUnitNode, UnitType } from '../../../libs/api-clients/admin-iam';

interface Row { node: OrgUnitNode; depth: number }
type Pending = { kind: 'move' | 'close'; node: OrgUnitNode };

/**
 * Organigramme (ADM-06) : types d'unités (`listUnitTypes`, `createUnitType`, `updateUnitType`) et arbre des unités
 * (`getOrgTree`, `createOrgUnit`, `updateOrgUnit`, `performOrgUnitAction`), via le client généré (D32). L'impact d'un
 * déplacement ou d'une fermeture est affiché et confirmé avant l'appel ; refus (403), conflit (409) et validation (422)
 * restent ceux du serveur.
 */
@Component({
  selector: 'ct-org',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatProgressBarModule],
  template: `
    <section>
      <header class="page-head"><h1>Organigramme</h1></header>
      <p class="page-sub">Types d'unités et arbre des unités de l'organisation. Une unité fermée reste visible dans l'historique.</p>

      @if (message(); as msg) { <p class="ok" role="status" data-cy="org-message">{{ msg }}</p> }
      @if (error(); as code) { <p class="err" role="alert" data-cy="org-error">{{ errorHint(code) }}</p> }
      @if (loading()) { <mat-progress-bar mode="indeterminate" data-cy="org-loading"></mat-progress-bar> }

      <div class="tabs" role="tablist">
        <button type="button" role="tab" mat-stroked-button data-cy="org-tab-tree" [attr.aria-selected]="tab() === 'tree'" (click)="tab.set('tree')">Arbre</button>
        <button type="button" role="tab" mat-stroked-button data-cy="org-tab-types" [attr.aria-selected]="tab() === 'types'" (click)="tab.set('types')">Types d'unités</button>
      </div>

      @if (tab() === 'tree') {
        <div class="toolbar">
          <div class="field"><label for="org-search">Rechercher</label><input id="org-search" data-cy="org-search" [ngModel]="search()" (ngModelChange)="search.set($event)" /></div>
          <label class="inline"><input type="checkbox" data-cy="org-closed" [checked]="includeClosed()" (change)="toggleClosed()" /> Afficher les unités fermées</label>
          <button mat-flat-button type="button" data-cy="org-new" (click)="creating.set(!creating())">Créer une unité</button>
        </div>

        @if (creating()) {
          <mat-card appearance="outlined" class="block" data-cy="org-form">
            <mat-card-content>
              <div class="field"><label for="org-code">Code</label><input id="org-code" data-cy="org-code" [(ngModel)]="newCode" /></div>
              <div class="field"><label for="org-label">Libellé</label><input id="org-label" data-cy="org-label" [(ngModel)]="newLabel" /></div>
              <div class="field"><label for="org-type">Type</label>
                <select id="org-type" data-cy="org-type" [(ngModel)]="newTypeId">
                  @for (t of types(); track t.id) { <option [value]="t.id">{{ t.label.fr }}</option> }
                </select>
              </div>
              <div class="field"><label for="org-parent">Unité parente</label>
                <select id="org-parent" data-cy="org-parent" [(ngModel)]="newParentId">
                  <option value="">— Niveau racine —</option>
                  @for (r of allRows(); track r.node.id) { <option [value]="r.node.id">{{ r.node.label }}</option> }
                </select>
              </div>
              <div class="actions">
                <button mat-flat-button type="button" data-cy="org-submit" [disabled]="!newCode.trim() || !newLabel.trim() || !newTypeId" (click)="createUnit()">Créer</button>
                <button mat-button type="button" data-cy="org-cancel" (click)="creating.set(false)">Annuler</button>
              </div>
            </mat-card-content>
          </mat-card>
        }

        @if (pending(); as p) {
          <mat-card appearance="outlined" class="block confirm" data-cy="org-confirm" role="alertdialog" aria-label="Confirmer l'opération">
            <mat-card-content>
              <p data-cy="org-impact">
                @if (p.kind === 'close') { Fermer « {{ p.node.label }} » }
                @else { Déplacer « {{ p.node.label }} » }
                : {{ impact(p.node).units }} unité(s) et {{ impact(p.node).assignments }} affectation(s) concernée(s).
              </p>
              @if (p.kind === 'move') {
                <div class="field"><label for="org-target">Nouvelle unité parente</label>
                  <select id="org-target" data-cy="org-target" [(ngModel)]="targetId">
                    <option value="">— Choisir —</option>
                    @for (r of targets(p.node); track r.node.id) { <option [value]="r.node.id">{{ r.node.label }}</option> }
                  </select>
                </div>
              }
              <div class="actions">
                <button mat-flat-button type="button" data-cy="org-confirm-ok" [disabled]="p.kind === 'move' && !targetId" (click)="confirm()">Confirmer</button>
                <button mat-button type="button" data-cy="org-confirm-cancel" (click)="pending.set(null)">Annuler</button>
              </div>
            </mat-card-content>
          </mat-card>
        }

        @if (rows().length) {
          <mat-card appearance="outlined">
            <mat-card-content class="scroll">
              <table data-cy="org-tree">
                <thead><tr><th scope="col">Unité</th><th scope="col">Code</th><th scope="col">Type</th><th scope="col">Affectations</th><th scope="col">Actions</th></tr></thead>
                <tbody>
                  @for (r of rows(); track r.node.id) {
                    <tr data-cy="org-row" [class.closed]="r.node.closed">
                      <td [style.padding-inline-start.rem]="1 + r.depth * 1.5">{{ r.node.label }} @if (r.node.closed) { <em data-cy="org-closed-badge">(fermée)</em> }</td>
                      <td>{{ r.node.code }}</td>
                      <td>{{ r.node.typeLabel }}</td>
                      <td>{{ r.node.assignmentsCount ?? 0 }}</td>
                      <td>
                        @if (!r.node.closed) {
                          <button mat-button type="button" data-cy="org-move" (click)="ask('move', r.node)">Déplacer</button>
                          <button mat-button type="button" data-cy="org-close" (click)="ask('close', r.node)">Fermer</button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </mat-card-content>
          </mat-card>
        } @else if (!loading() && !error()) {
          <p class="muted" data-cy="org-empty">Aucune unité.</p>
        }
      } @else {
        <mat-card appearance="outlined" class="block">
          <mat-card-content class="scroll">
            <table data-cy="type-list">
              <thead><tr><th scope="col">Code</th><th scope="col">Libellé</th><th scope="col">Profondeur</th></tr></thead>
              <tbody>
                @for (t of types(); track t.id) {
                  <tr data-cy="type-row"><td>{{ t.code }}</td><td>{{ t.label.fr }}</td><td>{{ t.depth }}</td></tr>
                }
              </tbody>
            </table>
          </mat-card-content>
        </mat-card>
        <mat-card appearance="outlined" class="block" data-cy="type-form">
          <mat-card-content>
            <h2>Nouveau type d'unité</h2>
            <div class="field"><label for="type-code">Code</label><input id="type-code" data-cy="type-code" [(ngModel)]="typeCode" /></div>
            <div class="field"><label for="type-label">Libellé</label><input id="type-label" data-cy="type-label" [(ngModel)]="typeLabel" /></div>
            <div class="field"><label for="type-depth">Profondeur</label><input id="type-depth" type="number" min="1" data-cy="type-depth" [(ngModel)]="typeDepth" /></div>
            <div class="actions">
              <button mat-flat-button type="button" data-cy="type-submit" [disabled]="!typeCode.trim() || !typeLabel.trim()" (click)="createType()">Créer le type</button>
            </div>
          </mat-card-content>
        </mat-card>
      }
    </section>
  `,
  styles: [
    `
      .page-sub { color: var(--ct-color-muted); margin-top: 0; max-width: 72ch; }
      .tabs, .toolbar, .actions { display: flex; gap: var(--ct-space-2); align-items: end; flex-wrap: wrap; margin-bottom: var(--ct-space-3); }
      .tabs [aria-selected='true'] { background: var(--ct-color-surface); font-weight: 600; }
      .block { margin-bottom: var(--ct-space-3); }
      .confirm { border-color: var(--ct-color-border); }
      .scroll { overflow-x: auto; }
      table { border-collapse: collapse; width: 100%; }
      th, td { padding: var(--ct-space-2) var(--ct-space-3); border-bottom: 1px solid var(--ct-color-border); text-align: start; }
      thead th { background: var(--ct-color-surface); }
      tr.closed td { color: var(--ct-color-muted); }
      .field { display: flex; flex-direction: column; gap: var(--ct-space-1); margin-bottom: var(--ct-space-2); max-width: 32rem; }
      .field input, .field select { padding: var(--ct-space-2); border: 1px solid var(--ct-color-border); border-radius: var(--ct-radius-sm); font: inherit; }
      .inline { display: flex; gap: var(--ct-space-1); align-items: center; }
      .ok { color: var(--ct-green-600); }
      .err { color: var(--ct-red-700); }
      .muted { color: var(--ct-color-muted); }
    `,
  ],
})
export class OrgPage implements OnInit {
  private readonly api = inject(OrgService);

  readonly tab = signal<'tree' | 'types'>('tree');
  readonly tree = signal<OrgUnitNode[]>([]);
  readonly types = signal<UnitType[]>([]);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly includeClosed = signal(false);
  readonly search = signal('');
  readonly pending = signal<Pending | null>(null);
  readonly message = signal<string | null>(null);
  readonly error = signal<number | null>(null);
  newCode = '';
  newLabel = '';
  newTypeId = '';
  newParentId = '';
  targetId = '';
  typeCode = '';
  typeLabel = '';
  typeDepth = 1;

  readonly allRows = computed(() => this.flatten(this.tree(), 0));
  readonly rows = computed(() => {
    const q = this.search().trim().toLowerCase();
    return q ? this.allRows().filter((r) => (r.node.label + ' ' + r.node.code).toLowerCase().includes(q)) : this.allRows();
  });

  ngOnInit(): void {
    this.loadTypes();
    this.loadTree();
  }

  toggleClosed(): void {
    this.includeClosed.update((v) => !v);
    this.loadTree();
  }

  /** Unités et affectations touchées par une opération sur ce nœud et son sous-arbre. */
  impact(n: OrgUnitNode): { units: number; assignments: number } {
    const rows = this.flatten([n], 0);
    return { units: rows.length, assignments: rows.reduce((s, r) => s + (r.node.assignmentsCount ?? 0), 0) };
  }

  /** Cibles de déplacement : toute unité ouverte hors du sous-arbre déplacé. */
  targets(n: OrgUnitNode): Row[] {
    const banned = new Set(this.flatten([n], 0).map((r) => r.node.id));
    return this.allRows().filter((r) => !banned.has(r.node.id) && !r.node.closed);
  }

  ask(kind: Pending['kind'], node: OrgUnitNode): void {
    this.targetId = '';
    this.pending.set({ kind, node });
  }

  confirm(): void {
    const p = this.pending();
    if (!p) return;
    this.reset();
    const body = p.kind === 'move' ? { version: 0, payload: { parentId: this.targetId } } : { version: 0 };
    this.api.performOrgUnitAction(p.node.id, p.kind, body).subscribe({
      next: () => { this.pending.set(null); this.message.set(p.kind === 'move' ? 'Unité déplacée.' : 'Unité fermée.'); this.loadTree(); },
      error: (e: HttpErrorResponse) => { this.pending.set(null); this.error.set(e.status); },
    });
  }

  createUnit(): void {
    this.reset();
    this.api.createOrgUnit({ code: this.newCode.trim(), label: { fr: this.newLabel.trim() }, unitTypeId: this.newTypeId, ...(this.newParentId ? { parentId: this.newParentId } : {}) }).subscribe({
      next: () => {
        this.creating.set(false);
        this.newCode = this.newLabel = this.newParentId = '';
        this.message.set('Unité créée.');
        this.loadTree();
      },
      error: (e: HttpErrorResponse) => this.error.set(e.status),
    });
  }

  createType(): void {
    this.reset();
    this.api.createUnitType({ code: this.typeCode.trim(), label: { fr: this.typeLabel.trim() }, depth: this.typeDepth }).subscribe({
      next: () => { this.typeCode = this.typeLabel = ''; this.message.set('Type d’unité créé.'); this.loadTypes(); },
      error: (e: HttpErrorResponse) => this.error.set(e.status),
    });
  }

  errorHint(code: number): string {
    if (code === 403) return 'Action refusée par le serveur : droits insuffisants sur l’organigramme.';
    if (code === 409) return 'Conflit : l’organigramme a été modifié entre-temps. Rechargez la page.';
    if (code === 422) return 'Opération invalide : code unique et libellé obligatoires, cible de déplacement valide.';
    return 'Impossible de charger ou de modifier l’organigramme.';
  }

  private reset(): void {
    this.message.set(null);
    this.error.set(null);
  }

  private flatten(nodes: OrgUnitNode[], depth: number): Row[] {
    return nodes.flatMap((n) => [{ node: n, depth }, ...this.flatten(n.children ?? [], depth + 1)]);
  }

  private loadTypes(): void {
    this.api.listUnitTypes().subscribe({
      next: (r) => { this.types.set(r); if (!this.newTypeId && r[0]?.id) this.newTypeId = r[0].id; },
      error: (e: HttpErrorResponse) => this.error.set(e.status),
    });
  }

  private loadTree(): void {
    this.loading.set(true);
    this.api.getOrgTree(this.includeClosed()).subscribe({
      next: (r) => { this.tree.set(r); this.loading.set(false); },
      error: (e: HttpErrorResponse) => { this.tree.set([]); this.error.set(e.status); this.loading.set(false); },
    });
  }
}
