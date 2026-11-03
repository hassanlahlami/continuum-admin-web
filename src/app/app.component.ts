import { Component, inject, signal } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthFacade } from './auth/auth.facade';
import { map } from 'rxjs/operators';

/**
 * Coquille de la Plateforme Admin Système (§1.2/§4.4.2) — layout « cockpit » Material habillé par les
 * tokens --ct-* (pont M3, theme.scss), à parité avec app-web : barre latérale repliable, barre supérieure
 * (utilisateur), zone de contenu routée. Responsive via BreakpointObserver.
 */
@Component({
  selector: 'ct-root',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatTooltipModule,
  ],
  template: `
    <mat-sidenav-container class="shell" [autosize]="true">
      <mat-sidenav
        #drawer
        class="shell-nav"
        [class.collapsed]="collapsed() && !isHandset()"
        data-cy="app-sidenav"
        [mode]="isHandset() ? 'over' : 'side'"
        [opened]="!isHandset()"
      >
        <div class="brand"><mat-icon aria-hidden="true">admin_panel_settings</mat-icon> <span>Continuum · Admin</span></div>
        <mat-nav-list>
          <a mat-list-item routerLink="/" routerLinkActive="active-nav" [routerLinkActiveOptions]="{ exact: true }"
             data-cy="nav-home"
             [matTooltip]="collapsed() && !isHandset() ? 'Accueil' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">home</mat-icon>
            <span matListItemTitle>Accueil</span>
          </a>
          <a mat-list-item routerLink="/users" routerLinkActive="active-nav"
             data-cy="nav-users"
             [matTooltip]="collapsed() && !isHandset() ? 'Utilisateurs' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">group</mat-icon>
            <span matListItemTitle>Utilisateurs</span>
          </a>
          <a mat-list-item routerLink="/positions" routerLinkActive="active-nav"
             data-cy="nav-positions"
             [matTooltip]="collapsed() && !isHandset() ? 'Positions' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">work</mat-icon>
            <span matListItemTitle>Positions</span>
          </a>
          <a mat-list-item routerLink="/roles" routerLinkActive="active-nav"
             data-cy="nav-roles"
             [matTooltip]="collapsed() && !isHandset() ? 'Rôles' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">rule</mat-icon>
            <span matListItemTitle>Rôles</span>
          </a>
          <a mat-list-item routerLink="/sod-rules" routerLinkActive="active-nav"
             data-cy="nav-sod-rules"
             [matTooltip]="collapsed() && !isHandset() ? 'Séparation des tâches' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">balance</mat-icon>
            <span matListItemTitle>Séparation des tâches</span>
          </a>
          <a mat-list-item routerLink="/entities" routerLinkActive="active-nav"
             data-cy="nav-entities"
             [matTooltip]="collapsed() && !isHandset() ? 'Entités' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">apartment</mat-icon>
            <span matListItemTitle>Entités</span>
          </a>
          <a mat-list-item routerLink="/org" routerLinkActive="active-nav"
             data-cy="nav-org"
             [matTooltip]="collapsed() && !isHandset() ? 'Organigramme' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">account_tree</mat-icon>
            <span matListItemTitle>Organigramme</span>
          </a>
          <a mat-list-item routerLink="/pending" routerLinkActive="active-nav"
             data-cy="nav-pending"
             [matTooltip]="collapsed() && !isHandset() ? 'Validations en attente' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">how_to_reg</mat-icon>
            <span matListItemTitle>Validations en attente</span>
          </a>
          <a mat-list-item routerLink="/assignments" routerLinkActive="active-nav"
             data-cy="nav-assignments"
             [matTooltip]="collapsed() && !isHandset() ? 'Affectations' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">badge</mat-icon>
            <span matListItemTitle>Affectations</span>
          </a>
          <a mat-list-item routerLink="/audit-trail" routerLinkActive="active-nav"
             data-cy="nav-audit-trail"
             [matTooltip]="collapsed() && !isHandset() ? 'Piste d\\'audit' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">receipt_long</mat-icon>
            <span matListItemTitle>Piste d'audit</span>
          </a>
          <a mat-list-item routerLink="/connectors" routerLinkActive="active-nav"
             data-cy="nav-connectors"
             [matTooltip]="collapsed() && !isHandset() ? 'Connecteurs' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">cable</mat-icon>
            <span matListItemTitle>Connecteurs</span>
          </a>
          <a mat-list-item routerLink="/caches" routerLinkActive="active-nav"
             data-cy="nav-caches"
             [matTooltip]="collapsed() && !isHandset() ? 'Caches' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">memory</mat-icon>
            <span matListItemTitle>Caches</span>
          </a>
          <a mat-list-item routerLink="/health" routerLinkActive="active-nav"
             data-cy="nav-health"
             [matTooltip]="collapsed() && !isHandset() ? 'Supervision' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">monitor_heart</mat-icon>
            <span matListItemTitle>Supervision</span>
          </a>
          <a mat-list-item routerLink="/logs" routerLinkActive="active-nav"
             data-cy="nav-logs"
             [matTooltip]="collapsed() && !isHandset() ? 'Logs' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">article</mat-icon>
            <span matListItemTitle>Logs</span>
          </a>
          <a mat-list-item routerLink="/errors" routerLinkActive="active-nav"
             data-cy="nav-errors"
             [matTooltip]="collapsed() && !isHandset() ? 'Erreurs' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">error_outline</mat-icon>
            <span matListItemTitle>Erreurs</span>
          </a>
          <a mat-list-item routerLink="/authz-simulator" routerLinkActive="active-nav"
             data-cy="nav-authz-simulator"
             [matTooltip]="collapsed() && !isHandset() ? 'Simulateur' : ''" matTooltipPosition="right"
             (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">manage_search</mat-icon>
            <span matListItemTitle>Simulateur</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="shell-content">
        <mat-toolbar class="app-bar">
          <button mat-icon-button aria-label="Réduire ou déployer la navigation"
                  (click)="toggleNav(drawer)" data-cy="nav-toggle">
            <mat-icon>menu</mat-icon>
          </button>
          <span class="app-bar-title">Administration Système</span>
          <span class="spacer"></span>
          <form class="trace-lookup" (submit)="openTrace($event, traceInput.value); traceInput.value = ''">
            <input #traceInput name="trace" placeholder="Référence de trace" aria-label="Référence de trace"
                   data-cy="trace-lookup" autocomplete="off" />
          </form>
          <button mat-icon-button (click)="cycleTheme()" data-cy="theme-toggle"
                  [attr.aria-label]="'Thème : ' + theme()">
            <mat-icon>{{ themeIcon() }}</mat-icon>
          </button>
          @if (displayName(); as name) {
            <div class="user" data-cy="app-user"><strong>{{ name }}</strong><span>Admin Système</span></div>
            <button mat-icon-button (click)="signOut()" data-cy="logout" aria-label="Se déconnecter"><mat-icon>logout</mat-icon></button>
          }
        </mat-toolbar>
        <main class="content"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .shell { position: absolute; inset: 0; background: var(--ct-color-bg); }
      .shell-nav {
        width: 264px; border-right: 1px solid var(--ct-color-border); background: var(--ct-color-surface);
        overflow-x: hidden; transition: width 0.16s ease;
      }
      .shell-nav.collapsed { width: 68px; }
      .shell-nav.collapsed .brand span,
      .shell-nav.collapsed [matListItemTitle] { display: none; }
      .shell-nav.collapsed .brand { justify-content: center; padding: 0; }
      .brand {
        display: flex; align-items: center; gap: var(--ct-space-2);
        height: var(--ct-appbar-height); padding: 0 var(--ct-space-4);
        font-family: var(--ct-font-heading); font-weight: 700; color: var(--ct-color-primary);
        border-bottom: 1px solid var(--ct-color-border);
      }
      .brand mat-icon { color: var(--ct-color-primary); }
      a.active-nav { --mat-list-list-item-label-text-color: var(--ct-color-primary); }
      a.active-nav mat-icon { color: var(--ct-color-primary); }
      .app-bar {
        position: sticky; top: 0; z-index: 2;
        background: var(--ct-color-surface); color: var(--ct-color-text);
        border-bottom: 1px solid var(--ct-color-border); box-shadow: var(--ct-shadow-sm);
      }
      .app-bar-title { font-family: var(--ct-font-heading); font-weight: 600; font-size: 1rem; }
      .spacer { flex: 1 1 auto; }
      .trace-lookup input {
        font-family: var(--ct-font-mono); font-size: .82rem; width: 16rem; padding: var(--ct-space-1) var(--ct-space-2);
        border: 1px solid var(--ct-color-border); border-radius: var(--ct-radius-sm);
        background: var(--ct-color-surface); color: var(--ct-color-text);
      }
      .user { display: flex; flex-direction: column; line-height: 1.15; text-align: right; }
      .user strong { font-size: .9rem; } .user span { font-size: .78rem; color: var(--ct-color-muted); }
      /* Le contenu occupe toute la largeur restante à droite de la barre latérale. */
      .content { padding: var(--ct-space-5); width: 100%; }
    `,
  ],
})
export class AppComponent {
  private readonly auth = inject(AuthFacade);
  private readonly router = inject(Router);
  readonly theme = signal<'auto' | 'light' | 'dark'>(this.readTheme());
  /** Barre latérale repliée en rail d'icônes (bureau) ; persistée par navigateur. */
  readonly collapsed = signal<boolean>(this.readCollapsed());
  readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  constructor() {
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    this.applyTheme();
  }

  /** Saisie directe d'une référence de trace depuis l'en-tête (OPS-09). */
  openTrace(event: Event, value: string): void {
    event.preventDefault();
    const id = value.trim();
    if (id) void this.router.navigate(['/traces', id]);
  }

  displayName(): string | null {
    return this.auth.session().displayName ?? null;
  }

  signOut(): void {
    this.auth.signOut().subscribe({ complete: () => void this.router.navigate(['/login']), error: () => void this.router.navigate(['/login']) });
  }

  /** Mobile : ouvre/ferme le tiroir. Bureau : replie/déploie le rail (persisté). */
  toggleNav(drawer: { toggle: () => void }): void {
    if (this.isHandset()) {
      drawer.toggle();
      return;
    }
    const next = !this.collapsed();
    this.collapsed.set(next);
    try {
      localStorage.setItem('ct-nav-collapsed', String(next));
    } catch {
      // stockage indisponible : la préférence reste pour la session.
    }
  }

  private readCollapsed(): boolean {
    try {
      return localStorage.getItem('ct-nav-collapsed') === 'true';
    } catch {
      return false;
    }
  }

  /** Bascule la préférence de thème : auto → clair → sombre → auto (parité app-web). */
  cycleTheme(): void {
    const next = this.theme() === 'auto' ? 'light' : this.theme() === 'light' ? 'dark' : 'auto';
    this.theme.set(next);
    try {
      localStorage.setItem('ct-theme', next);
    } catch {
      // stockage indisponible
    }
    this.applyTheme();
  }

  themeIcon(): string {
    return this.theme() === 'light' ? 'light_mode' : this.theme() === 'dark' ? 'dark_mode' : 'brightness_auto';
  }

  private readTheme(): 'auto' | 'light' | 'dark' {
    try {
      const v = localStorage.getItem('ct-theme');
      return v === 'light' || v === 'dark' ? v : 'auto';
    } catch {
      return 'auto';
    }
  }

  private applyTheme(): void {
    const el = document.documentElement;
    if (this.theme() === 'auto') {
      delete el.dataset.theme;
    } else {
      el.dataset.theme = this.theme();
    }
  }
}
