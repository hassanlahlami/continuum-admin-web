import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ChangeRequest, ChangeRequestsService } from '../../../libs/api-clients/admin-iam';

/**
 * Demandes en attente de validation (ADM-14, §2.1.8) — double validation des changements d'habilitation sensibles :
 * `listChangeRequests`, `performChangeRequestAction`, via le client généré (D32). Le front n'enforce rien : les
 * actions proposées sont `availableActions` ; refus (403, demandeur/bénéficiaire), conflit (409) et motif
 * manquant (422) sont ceux décidés par le serveur.
 */
@Component({
  selector: 'ct-pending-changes',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatProgressBarModule],
  template: `
    <section>
      <header class="page-head"><h1>Validations en attente</h1></header>
      <p class="page-sub">Changements d'habilitation sensibles soumis à double validation : ni le demandeur ni le bénéficiaire ne peuvent les approuver.</p>

      @if (message(); as msg) { <p class="ok" role="status" data-cy="cr-message">{{ msg }}</p> }
      @if (error(); as code) { <p class="err" role="alert" data-cy="cr-error">{{ errorHint(code) }}</p> }
      @if (loading()) { <mat-progress-bar mode="indeterminate" data-cy="cr-loading"></mat-progress-bar> }

      @if (rejecting(); as r) {
        <mat-card appearance="outlined" class="form" data-cy="cr-reject-form">
          <mat-card-content>
            <div class="field"><label for="cr-reason">Motif du rejet (obligatoire)</label>
              <input id="cr-reason" name="reason" data-cy="cr-reason" [(ngModel)]="reason" /></div>
            <div class="actions">
              <button mat-flat-button type="button" data-cy="cr-reject-confirm" [disabled]="!reason.trim()" (click)="act(r, 'reject', reason)">Confirmer le rejet</button>
              <button mat-button type="button" data-cy="cr-reject-cancel" (click)="rejecting.set(null)">Annuler</button>
            </div>
          </mat-card-content>
        </mat-card>
      }

      @if (requests().length) {
        <mat-card appearance="outlined">
          <mat-card-content class="scroll">
            <table data-cy="cr-list">
              <thead><tr>
                <th scope="col">Type</th><th scope="col">Résumé</th><th scope="col">Demandeur</th><th scope="col">Bénéficiaire</th>
                <th scope="col">Fonctionnalités sensibles</th><th scope="col">Date</th><th scope="col"><span class="sr-only">Actions</span></th>
              </tr></thead>
              <tbody>
                @for (c of requests(); track c.id) {
                  <tr data-cy="cr-row">
                    <td>{{ kindLabel(c.kind) }}</td>
                    <td>{{ c.summary }}</td>
                    <td>{{ c.requestedBy.displayName }}</td>
                    <td>{{ c.beneficiary?.displayName ?? '—' }}</td>
                    <td data-cy="cr-sensitive">{{ c.sensitiveFeatures?.join(', ') || '—' }}</td>
                    <td>{{ c.requestedAt }}</td>
                    <td class="row-actions">
                      @if (can(c, 'approve')) {
                        <button mat-button type="button" data-cy="cr-approve" (click)="act(c, 'approve')">Approuver</button>
                      }
                      @if (can(c, 'reject')) {
                        <button mat-button type="button" data-cy="cr-reject" (click)="startReject(c)">Rejeter</button>
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </mat-card-content>
        </mat-card>
      } @else if (!loading() && !error()) {
        <p class="muted" data-cy="cr-empty">Aucune demande en attente.</p>
      }
    </section>
  `,
  styles: [
    `
      .page-sub { color: var(--ct-color-muted); margin-top: 0; max-width: 72ch; }
      .scroll { overflow-x: auto; }
      table { border-collapse: collapse; width: 100%; }
      th, td { padding: var(--ct-space-2) var(--ct-space-3); border-bottom: 1px solid var(--ct-color-border); text-align: start; }
      thead th { background: var(--ct-color-surface); }
      .actions { display: flex; gap: var(--ct-space-2); }
      .form { margin-bottom: var(--ct-space-3); }
      .field { display: flex; flex-direction: column; gap: var(--ct-space-1); margin-bottom: var(--ct-space-2); max-width: 32rem; }
      .field input { padding: var(--ct-space-2); border: 1px solid var(--ct-color-border); border-radius: var(--ct-radius-sm); font: inherit; }
      .row-actions { white-space: nowrap; }
      .ok { color: var(--ct-green-600); }
      .err { color: var(--ct-red-700); }
      .muted { color: var(--ct-color-muted); }
      .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
    `,
  ],
})
export class PendingChangesPage implements OnInit {
  private readonly api = inject(ChangeRequestsService);

  readonly requests = signal<ChangeRequest[]>([]);
  readonly loading = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<number | null>(null);
  /** Demande dont on saisit le motif de rejet ; absente → formulaire fermé. */
  readonly rejecting = signal<ChangeRequest | null>(null);
  reason = '';

  private static readonly KINDS: Record<string, string> = {
    ASSIGNMENT: 'Affectation', ROLE_FEATURES: 'Fonctionnalités d’un rôle', POSITION: 'Position', SOD_RULE: 'Règle SoD',
  };

  ngOnInit(): void {
    this.load();
  }

  kindLabel(kind: string): string {
    return PendingChangesPage.KINDS[kind] ?? kind;
  }

  /** Action permise telle que décidée par le serveur (`availableActions`) : le front n'infère rien. */
  can(c: ChangeRequest, code: string): boolean {
    return !!c.availableActions?.some((a) => a.code === code);
  }

  startReject(c: ChangeRequest): void {
    this.clear();
    this.reason = '';
    this.rejecting.set(c);
  }

  act(c: ChangeRequest, code: 'approve' | 'reject', comment?: string): void {
    this.clear();
    this.api.performChangeRequestAction(c.id, code, { version: 0, ...(comment ? { comment } : {}) }).subscribe({
      next: () => {
        this.rejecting.set(null);
        this.message.set(code === 'approve' ? 'Demande approuvée.' : 'Demande rejetée.');
        this.load();
      },
      error: (e: HttpErrorResponse) => {
        this.error.set(e.status);
        if (e.status === 409) { this.rejecting.set(null); this.load(); }
      },
    });
  }

  errorHint(code: number): string {
    if (code === 403) return 'Action refusée par le serveur : vous ne pouvez pas valider une demande dont vous êtes l’auteur ou le bénéficiaire.';
    if (code === 409) return 'La demande a été traitée entre-temps : la liste a été rechargée.';
    if (code === 422) return 'Un motif est obligatoire pour rejeter une demande.';
    return 'Impossible de charger ou de traiter les demandes.';
  }

  private clear(): void {
    this.message.set(null);
    this.error.set(null);
  }

  private load(): void {
    this.loading.set(true);
    this.api.listChangeRequests().subscribe({
      next: (r) => { this.requests.set(r); this.loading.set(false); },
      error: (e: HttpErrorResponse) => { this.requests.set([]); this.error.set(e.status); this.loading.set(false); },
    });
  }
}
