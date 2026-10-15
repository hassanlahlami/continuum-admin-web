import { Component, inject, signal } from '@angular/core';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';
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
  ],
  template: `
    <mat-sidenav-container class="shell">
      <mat-sidenav
        #drawer
        class="shell-nav"
        data-cy="app-sidenav"
        [mode]="isHandset() ? 'over' : 'side'"
        [opened]="!isHandset()"
      >
        <div class="brand"><mat-icon aria-hidden="true">admin_panel_settings</mat-icon> <span>Continuum · Admin</span></div>
        <mat-nav-list>
          <a mat-list-item routerLink="/" routerLinkActive="active-nav" [routerLinkActiveOptions]="{ exact: true }"
             data-cy="nav-assignments" (click)="isHandset() && drawer.close()">
            <mat-icon matListItemIcon aria-hidden="true">badge</mat-icon>
            <span matListItemTitle>Affectations</span>
          </a>
        </mat-nav-list>
      </mat-sidenav>

      <mat-sidenav-content class="shell-content">
        <mat-toolbar class="app-bar">
          @if (isHandset()) {
            <button mat-icon-button aria-label="Menu" (click)="drawer.toggle()" data-cy="nav-toggle">
              <mat-icon>menu</mat-icon>
            </button>
          }
          <span class="app-bar-title">Administration Système</span>
          <span class="spacer"></span>
          @if (displayName(); as name) {
            <div class="user" data-cy="app-user"><strong>{{ name }}</strong><span>Admin Système</span></div>
          }
        </mat-toolbar>
        <main class="content"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>
  `,
  styles: [
    `
      .shell { position: absolute; inset: 0; background: var(--ct-color-bg); }
      .shell-nav { width: 264px; border-right: 1px solid var(--ct-color-border); background: var(--ct-color-surface); }
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
      .user { display: flex; flex-direction: column; line-height: 1.15; text-align: right; }
      .user strong { font-size: .9rem; } .user span { font-size: .78rem; color: var(--ct-color-muted); }
      .content { padding: var(--ct-space-5); max-width: 1180px; margin: 0 auto; }
    `,
  ],
})
export class AppComponent {
  private readonly oauth = inject(OAuthService);
  readonly isHandset = toSignal(
    inject(BreakpointObserver)
      .observe([Breakpoints.Handset, Breakpoints.TabletPortrait])
      .pipe(map((r) => r.matches)),
    { initialValue: false },
  );

  constructor() {
    inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
  }

  displayName(): string | null {
    const claims = this.oauth.getIdentityClaims() as { name?: string; preferred_username?: string } | null;
    return claims?.name ?? claims?.preferred_username ?? null;
  }
}
