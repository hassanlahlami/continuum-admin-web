import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { Entity, EntitiesService } from '../../../libs/api-clients/admin-iam';

/**
 * Entités / filiales hébergées (ADM-02, D5) : `listEntities` et `createEntity` (opération longue suivie par un Job,
 * 202), via le client généré (D32). Le front n'enforce rien : refus (403) et validation (422) sont ceux du serveur.
 */
@Component({
  selector: 'ct-entities',
  standalone: true,
  imports: [FormsModule, MatButtonModule, MatCardModule, MatProgressBarModule],
  template: `
    <section>
      <header class="page-head"><h1>Entités</h1></header>
      <p class="page-sub">Filiales (tenants) hébergées dans l'installation. La création déclenche un Job : schéma ou PDB, realm Keycloak et pack initial.</p>

      @if (message(); as msg) { <p class="ok" role="status" data-cy="ent-message">{{ msg }}</p> }
      @if (error(); as code) { <p class="err" role="alert" data-cy="ent-error">{{ errorHint(code) }}</p> }
      @if (loading()) { <mat-progress-bar mode="indeterminate" data-cy="ent-loading"></mat-progress-bar> }

      <div class="actions">
        <button mat-flat-button type="button" data-cy="ent-new" (click)="creating.set(!creating())">Créer une entité</button>
      </div>

      @if (creating()) {
        <mat-card appearance="outlined" class="form" data-cy="ent-form">
          <mat-card-content>
            <div class="field"><label for="ent-code">Code</label><input id="ent-code" name="code" data-cy="ent-code" [(ngModel)]="code" /></div>
            <div class="field"><label for="ent-label">Libellé</label><input id="ent-label" name="label" data-cy="ent-label" [(ngModel)]="label" /></div>
            <div class="field"><label for="ent-pack">Pack de conformité</label><input id="ent-pack" name="pack" data-cy="ent-pack" [(ngModel)]="packCode" /></div>
            <div class="actions">
              <button mat-flat-button type="button" data-cy="ent-submit" [disabled]="!code.trim() || !label.trim()" (click)="create()">Créer</button>
              <button mat-button type="button" data-cy="ent-cancel" (click)="creating.set(false)">Annuler</button>
            </div>
          </mat-card-content>
        </mat-card>
      }

      @if (entities().length) {
        <mat-card appearance="outlined">
          <mat-card-content class="scroll">
            <table data-cy="ent-list">
              <thead><tr>
                <th scope="col">Code</th><th scope="col">Libellé</th><th scope="col">Statut</th><th scope="col">Isolation</th>
                <th scope="col">Realm</th><th scope="col">Pack</th><th scope="col">Utilisateurs</th>
              </tr></thead>
              <tbody>
                @for (e of entities(); track e.id) {
                  <tr data-cy="ent-row">
                    <td>{{ e.code }}</td>
                    <td>{{ e.label }}</td>
                    <td data-cy="ent-status">{{ statusLabel(e.status) }}</td>
                    <td>{{ e.dataIsolation ?? '—' }}</td>
                    <td>{{ e.keycloakRealm ?? '—' }}</td>
                    <td>{{ e.packCode ?? '—' }}</td>
                    <td>{{ e.usersCount ?? '—' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </mat-card-content>
        </mat-card>
      } @else if (!loading() && !error()) {
        <p class="muted" data-cy="ent-empty">Aucune entité.</p>
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
      .actions { display: flex; gap: var(--ct-space-2); margin-bottom: var(--ct-space-3); }
      .form { margin-bottom: var(--ct-space-3); }
      .field { display: flex; flex-direction: column; gap: var(--ct-space-1); margin-bottom: var(--ct-space-2); max-width: 32rem; }
      .field input { padding: var(--ct-space-2); border: 1px solid var(--ct-color-border); border-radius: var(--ct-radius-sm); font: inherit; }
      .ok { color: var(--ct-green-600); }
      .err { color: var(--ct-red-700); }
      .muted { color: var(--ct-color-muted); }
    `,
  ],
})
export class EntitiesPage implements OnInit {
  private readonly api = inject(EntitiesService);

  readonly entities = signal<Entity[]>([]);
  readonly loading = signal(false);
  readonly creating = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<number | null>(null);
  code = '';
  label = '';
  packCode = '';

  private static readonly STATUSES: Record<string, string> = {
    PROVISIONING: 'Création en cours', ACTIVE: 'Active', SUSPENDED: 'Suspendue', MAINTENANCE: 'En maintenance',
  };

  ngOnInit(): void {
    this.load();
  }

  statusLabel(s: string): string {
    return EntitiesPage.STATUSES[s] ?? s;
  }

  create(): void {
    this.message.set(null);
    this.error.set(null);
    this.api.createEntity({ code: this.code.trim(), label: this.label.trim(), ...(this.packCode.trim() ? { packCode: this.packCode.trim() } : {}) }).subscribe({
      next: () => {
        this.creating.set(false);
        this.code = this.label = this.packCode = '';
        this.message.set('Création acceptée : l’entité est en cours de provisionnement.');
        this.load();
      },
      error: (e: HttpErrorResponse) => this.error.set(e.status),
    });
  }

  errorHint(code: number): string {
    if (code === 403) return 'Action refusée par le serveur : cette opération est réservée à l’administrateur du groupe.';
    if (code === 422) return 'Entité invalide : le code est obligatoire et doit être unique.';
    return 'Impossible de charger ou de créer les entités.';
  }

  private load(): void {
    this.loading.set(true);
    this.api.listEntities().subscribe({
      next: (r) => { this.entities.set(r); this.loading.set(false); },
      error: (e: HttpErrorResponse) => { this.entities.set([]); this.error.set(e.status); this.loading.set(false); },
    });
  }
}
