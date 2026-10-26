import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Entity, EntityInput, EntitiesService } from '../../../libs/api-clients/admin-iam';

/**
 * Fiche d'une entité (ADM-03) : `getEntity`, `updateEntity` (modules, langues) et `performEntityAction`
 * (suspendre / réactiver / maintenance), via le client généré (D32). Le front n'enforce rien : refus (403),
 * conflit de version (409) et validation (422) sont ceux du serveur.
 */
@Component({
  selector: 'ct-entity-detail',
  standalone: true,
  imports: [FormsModule, RouterLink, MatButtonModule, MatCardModule, MatProgressBarModule],
  template: `
    <section>
      <p><a routerLink="/entities" data-cy="ed-back">← Entités</a></p>
      @if (message(); as msg) { <p class="ok" role="status" data-cy="ed-message">{{ msg }}</p> }
      @if (error(); as code) { <p class="err" role="alert" data-cy="ed-error">{{ errorHint(code) }}</p> }
      @if (loading()) { <mat-progress-bar mode="indeterminate" data-cy="ed-loading"></mat-progress-bar> }

      @if (entity(); as e) {
        <header class="page-head"><h1 data-cy="ed-title">{{ e.label }}</h1></header>
        <mat-card appearance="outlined" class="block">
          <mat-card-content>
            <dl data-cy="ed-identity">
              <dt>Code</dt><dd>{{ e.code }}</dd>
              <dt>Statut</dt><dd data-cy="ed-status">{{ statusLabel(e.status) }}</dd>
              <dt>Isolation</dt><dd>{{ e.dataIsolation ?? '—' }}</dd>
              <dt>Realm Keycloak</dt><dd>{{ e.keycloakRealm ?? '—' }}</dd>
              <dt>Pack installé</dt><dd>{{ e.packCode ?? '—' }}</dd>
              <dt>Utilisateurs</dt><dd>{{ e.usersCount ?? '—' }}</dd>
            </dl>
            <div class="actions" data-cy="ed-state-actions">
              @if (e.status === 'ACTIVE') {
                <button mat-stroked-button type="button" data-cy="ed-suspend" (click)="act('suspend')">Suspendre</button>
                <button mat-stroked-button type="button" data-cy="ed-maintenance" (click)="act('maintenance')">Mettre en maintenance</button>
              } @else if (e.status === 'SUSPENDED' || e.status === 'MAINTENANCE') {
                <button mat-stroked-button type="button" data-cy="ed-reactivate" (click)="act('reactivate')">Réactiver</button>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card appearance="outlined" class="block">
          <mat-card-content>
            <h2>Modules activés</h2>
            <p class="muted">Désactiver un module masque ses fonctionnalités à tous les utilisateurs de l'entité.</p>
            <div class="checks" data-cy="ed-modules">
              @for (m of allModules; track m) {
                <label><input type="checkbox" [attr.data-cy]="'ed-mod-' + m" [checked]="modules().includes(m)" (change)="toggleModule(m)" /> {{ m }}</label>
              }
            </div>
            <h2>Langues</h2>
            <div class="checks" data-cy="ed-locales">
              @for (l of allLocales; track l) {
                <label><input type="checkbox" [attr.data-cy]="'ed-loc-' + l" [checked]="locales().includes(l)" (change)="toggleLocale(l)" /> {{ l }}</label>
              }
            </div>
            <div class="field">
              <label for="ed-default">Langue par défaut</label>
              <select id="ed-default" data-cy="ed-default" [ngModel]="defaultLocale()" (ngModelChange)="defaultLocale.set($event)">
                @for (l of locales(); track l) { <option [value]="l">{{ l }}</option> }
              </select>
            </div>
            <div class="field">
              <label for="ed-label">Libellé</label>
              <input id="ed-label" data-cy="ed-label" [ngModel]="label()" (ngModelChange)="label.set($event)" />
            </div>
            <div class="actions">
              <button mat-flat-button type="button" data-cy="ed-save" [disabled]="!label().trim()" (click)="save()">Enregistrer</button>
            </div>
          </mat-card-content>
        </mat-card>

        <nav class="links" aria-label="Pages liées">
          <a routerLink="/connectors" data-cy="ed-link-connectors">Connecteurs</a>
          <a routerLink="/caches" data-cy="ed-link-caches">Caches</a>
        </nav>
      }
    </section>
  `,
  styles: [
    `
      .block { margin-bottom: var(--ct-space-3); }
      dl { display: grid; grid-template-columns: max-content 1fr; gap: var(--ct-space-1) var(--ct-space-3); margin: 0 0 var(--ct-space-3); }
      dt { color: var(--ct-color-muted); }
      dd { margin: 0; }
      .actions { display: flex; gap: var(--ct-space-2); }
      .checks { display: flex; flex-wrap: wrap; gap: var(--ct-space-3); margin-bottom: var(--ct-space-3); }
      .field { display: flex; flex-direction: column; gap: var(--ct-space-1); margin-bottom: var(--ct-space-2); max-width: 32rem; }
      .field input, .field select { padding: var(--ct-space-2); border: 1px solid var(--ct-color-border); border-radius: var(--ct-radius-sm); font: inherit; }
      .links { display: flex; gap: var(--ct-space-3); }
      .ok { color: var(--ct-green-600); }
      .err { color: var(--ct-red-700); }
      .muted { color: var(--ct-color-muted); }
    `,
  ],
})
export class EntityDetailPage implements OnInit {
  private readonly api = inject(EntitiesService);
  private readonly route = inject(ActivatedRoute);

  readonly allModules = Object.values(Entity.EnabledModulesEnum);
  readonly allLocales = Object.values(Entity.LocalesEnum);

  readonly entity = signal<Entity | null>(null);
  readonly loading = signal(false);
  readonly message = signal<string | null>(null);
  readonly error = signal<number | null>(null);
  readonly modules = signal<Entity.EnabledModulesEnum[]>([]);
  readonly locales = signal<Entity.LocalesEnum[]>([]);
  readonly defaultLocale = signal('');
  readonly label = signal('');

  private static readonly STATUSES: Record<string, string> = {
    PROVISIONING: 'Création en cours', ACTIVE: 'Active', SUSPENDED: 'Suspendue', MAINTENANCE: 'En maintenance',
  };

  private id = '';

  ngOnInit(): void {
    this.id = this.route.snapshot.paramMap.get('entityId') ?? '';
    this.loading.set(true);
    this.api.getEntity(this.id).subscribe({
      next: (e) => { this.apply(e); this.loading.set(false); },
      error: (e: HttpErrorResponse) => { this.error.set(e.status); this.loading.set(false); },
    });
  }

  statusLabel(s: string): string {
    return EntityDetailPage.STATUSES[s] ?? s;
  }

  toggleModule(m: Entity.EnabledModulesEnum): void {
    this.modules.update((l) => (l.includes(m) ? l.filter((x) => x !== m) : [...l, m]));
  }

  toggleLocale(l: Entity.LocalesEnum): void {
    this.locales.update((x) => (x.includes(l) ? x.filter((y) => y !== l) : [...x, l]));
  }

  save(): void {
    const e = this.entity();
    if (!e) return;
    this.reset();
    const body: EntityInput = {
      version: e.version, code: e.code, label: this.label().trim(), enabledModules: this.modules(), locales: this.locales(),
      ...(this.defaultLocale() ? { defaultLocale: this.defaultLocale() } : {}), ...(e.packCode ? { packCode: e.packCode } : {}),
    };
    this.api.updateEntity(this.id, body).subscribe({
      next: (r) => { this.apply(r); this.message.set('Entité enregistrée.'); },
      error: (err: HttpErrorResponse) => this.error.set(err.status),
    });
  }

  act(code: 'suspend' | 'reactivate' | 'maintenance'): void {
    const e = this.entity();
    if (!e) return;
    this.reset();
    this.api.performEntityAction(this.id, code, { version: e.version ?? 0 }).subscribe({
      next: (r) => { this.apply(r); this.message.set('Statut mis à jour : ' + this.statusLabel(r.status) + '.'); },
      error: (err: HttpErrorResponse) => this.error.set(err.status),
    });
  }

  errorHint(code: number): string {
    if (code === 403) return 'Action refusée par le serveur : droits insuffisants pour cette entité.';
    if (code === 404) return 'Entité introuvable.';
    if (code === 409) return 'Conflit : l’entité a été modifiée entre-temps. Rechargez la page.';
    if (code === 422) return 'Entité invalide : libellé obligatoire, langue par défaut parmi les langues activées.';
    return 'Impossible de charger ou de modifier l’entité.';
  }

  private reset(): void {
    this.message.set(null);
    this.error.set(null);
  }

  private apply(e: Entity): void {
    this.entity.set(e);
    this.modules.set([...(e.enabledModules ?? [])]);
    this.locales.set([...(e.locales ?? [])]);
    this.defaultLocale.set(e.defaultLocale ?? '');
    this.label.set(e.label);
  }
}
