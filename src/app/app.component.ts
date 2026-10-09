import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { OAuthService } from 'angular-oauth2-oidc';

/**
 * Coquille de la Plateforme Admin Système (§1.2/§4.4.2) : barre d'application + zone routée.
 * Valeurs visuelles via tokens `--ct-*` (§1.6).
 */
@Component({
  selector: 'ct-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `
    <header class="app-bar">
      <div class="brand">Continuum · Admin</div>
      <div class="spacer"></div>
      @if (displayName(); as name) {
        <div class="user"><strong>{{ name }}</strong><span>Admin Système</span></div>
      }
    </header>
    <main><router-outlet /></main>
  `,
})
export class AppComponent {
  private readonly oauth = inject(OAuthService);

  displayName(): string | null {
    const claims = this.oauth.getIdentityClaims() as { name?: string; preferred_username?: string } | null;
    return claims?.name ?? claims?.preferred_username ?? null;
  }
}
