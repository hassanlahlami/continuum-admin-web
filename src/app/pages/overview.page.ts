import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { RouterLink } from '@angular/router';
import { AdminOverview, OverviewService } from '../../../libs/api-clients/admin-iam';
import { environment } from '../../environments/environment';

type Tone = 'ok' | 'warn' | 'bad' | 'neutral';

/** Indicateur du tableau de bord : valeur lue, ton visuel et page cible (absente tant que la page n'existe pas). */
interface Tile {
  key: string;
  label: string;
  icon: string;
  value: string;
  tone: Tone;
  link: string | null;
}

/** Libellés de l'état global (valeurs du contrat `AdminOverview.health`). */
const HEALTH_LABELS: Record<NonNullable<AdminOverview['health']>, string> = {
  OK: 'Opérationnel',
  DEGRADED: 'Dégradé',
  DOWN: 'Hors service',
};

/**
 * Accueil Admin Système (ADM-01) : tableau de bord lu via `getAdminOverview` (droit `admin.overview.read`, appliqué
 * par le serveur : 403 → message de refus). Chaque indicateur ouvre la page correspondante quand elle existe ; sinon
 * la tuile reste sans lien. Bandeau permanent de l'entité en cours (realm de l'émetteur OIDC). Sélecteurs `data-cy` (D36).
 */
@Component({
  selector: 'ct-overview',
  standalone: true,
  imports: [MatCardModule, MatIconModule, MatProgressBarModule, RouterLink],
  template: `
    <section>
      <div class="entity-banner" role="region" aria-label="Entité en cours" data-cy="overview-entity">
        <mat-icon aria-hidden="true">domain</mat-icon>
        <span>Entité en cours :</span> <strong data-cy="overview-entity-name">{{ entity }}</strong>
      </div>
      <header class="page-head"><h1>Accueil</h1></header>
      <p class="page-sub">État de l'installation et éléments en attente d'une décision.</p>

      @if (error()) {
        <p class="error" role="alert" data-cy="overview-error">{{ error() }}</p>
      }
      @if (loading()) {
        <mat-progress-bar mode="indeterminate" aria-label="Chargement" data-cy="overview-loading"></mat-progress-bar>
      }

      @if (tiles(); as list) {
        <div class="grid" data-cy="overview-tiles">
          @for (t of list; track t.key) {
            <mat-card appearance="outlined" [class]="'tone-' + t.tone" [attr.data-cy]="'tile-' + t.key">
              <mat-card-content class="tile">
                <mat-icon aria-hidden="true">{{ t.icon }}</mat-icon>
                <div class="label">{{ t.label }}</div>
                <div class="value" data-cy="tile-value">{{ t.value }}</div>
                @if (t.link) {
                  <a [routerLink]="t.link" [attr.aria-label]="'Ouvrir : ' + t.label" data-cy="tile-link">Ouvrir</a>
                } @else {
                  <span class="muted" data-cy="tile-nolink">Page non disponible</span>
                }
              </mat-card-content>
            </mat-card>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .entity-banner {
        display: flex; align-items: center; gap: var(--ct-space-2); padding: var(--ct-space-2) var(--ct-space-4);
        margin-bottom: var(--ct-space-4); background: var(--ct-color-primary-soft); color: var(--ct-color-text);
        border: 1px solid var(--ct-color-border);
      }
      .page-sub { color: var(--ct-color-muted); margin-top: 0; }
      .error { color: var(--ct-red-700); }
      .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: var(--ct-space-4); margin-top: var(--ct-space-4); }
      .tile { display: flex; flex-direction: column; gap: var(--ct-space-1); }
      .label { color: var(--ct-color-muted); }
      .value { font-family: var(--ct-font-heading); font-size: 1.6rem; font-weight: 700; }
      .tone-ok .value { color: var(--ct-green-600); }
      .tone-warn .value { color: var(--ct-amber-700); }
      .tone-bad .value { color: var(--ct-red-700); }
      .muted { color: var(--ct-color-muted); font-size: 0.85rem; }
    `,
  ],
})
export class OverviewPage implements OnInit {
  private readonly service = inject(OverviewService);
  /** Entité en cours : realm de l'émetteur OIDC (une entité par realm, D5). */
  readonly entity = environment.oidcIssuer.split('/').filter(Boolean).pop() ?? '';
  readonly loading = signal(true);
  readonly error = signal('');
  readonly tiles = signal<Tile[] | null>(null);

  ngOnInit(): void {
    this.service.getAdminOverview().subscribe({
      next: (o) => {
        this.loading.set(false);
        this.tiles.set(this.toTiles(o));
      },
      error: (e: HttpErrorResponse) => {
        this.loading.set(false);
        this.error.set(
          e.status === 403 ? 'Accès refusé : vous n’avez pas le droit de consulter cette page.' : 'Impossible de charger le tableau de bord.',
        );
      },
    });
  }

  private toTiles(o: AdminOverview): Tile[] {
    const count = (n: number | undefined, tone: Tone): { value: string; tone: Tone } =>
      n === undefined ? { value: '—', tone: 'neutral' } : { value: n.toLocaleString(), tone: n > 0 ? tone : 'ok' };
    const date = (v: string | undefined, f: (d: Date) => string): string => (v ? f(new Date(v)) : '—');
    const health = o.health;
    return [
      { key: 'health', label: 'Santé globale', icon: 'monitor_heart', value: health ? HEALTH_LABELS[health] : '—',
        tone: health === 'OK' ? 'ok' : health === 'DEGRADED' ? 'warn' : health ? 'bad' : 'neutral', link: null },
      { key: 'pending-change-requests', label: 'Demandes de changement en attente', icon: 'pending_actions', ...count(o.pendingChangeRequests, 'warn'), link: null },
      { key: 'pending-publications', label: 'Publications en attente', icon: 'publish', ...count(o.pendingPublications, 'warn'), link: null },
      { key: 'open-alerts', label: 'Alertes ouvertes', icon: 'notifications_active', ...count(o.openAlerts, 'bad'), link: null },
      { key: 'users-without-assignment', label: 'Utilisateurs sans affectation', icon: 'person_off', ...count(o.usersWithoutAssignment, 'warn'), link: '/users' },
      { key: 'static-sod-conflicts', label: 'Conflits SoD statiques', icon: 'gpp_maybe', ...count(o.staticSodConflicts, 'bad'), link: null },
      { key: 'last-directory-sync', label: 'Dernière synchronisation annuaire', icon: 'sync',
        value: date(o.lastDirectorySyncAt, (d) => d.toLocaleString()), tone: 'neutral', link: '/users' },
      { key: 'license-expires', label: 'Échéance de licence', icon: 'event',
        value: date(o.licenseExpiresOn, (d) => d.toLocaleDateString()), tone: 'neutral', link: null },
      { key: 'connectors-down', label: 'Connecteurs en panne', icon: 'cable', ...count(o.connectorsDown, 'bad'), link: '/connectors' },
    ];
  }
}
