import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { OAuthService, provideOAuthClient } from 'angular-oauth2-oidc';
import { BASE_PATH } from '../libs/api-clients/admin-iam';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { authConfig } from './app/auth/auth.config';
import { authInterceptor } from './app/auth/auth.interceptor';
import { environment } from './environments/environment';

/**
 * Amorçage de la Plateforme Admin Système (§4.2, standalone) : HTTP + intercepteur de jeton, routage
 * et client OIDC. L'administration exige une session : connexion forcée au démarrage (§4.5).
 *
 * <p>Hors production (D32), on démarre d'abord le Service Worker MSW pour servir les contrats sans
 * backend ni Keycloak ; en mode mock, la connexion OIDC est best-effort (sans Keycloak).
 */
async function startMocksInDev(): Promise<void> {
  if (!environment.production && environment.useMocks) {
    const { worker } = await import('./mocks/browser');
    await worker.start({ onUnhandledRequest: 'bypass' });
  }
}

startMocksInDev()
  .then(() =>
    bootstrapApplication(AppComponent, {
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideRouter(routes),
        provideOAuthClient(),
        { provide: BASE_PATH, useValue: environment.apiBaseUrl },
        provideAppInitializer(() => {
          const oauth = inject(OAuthService);
          oauth.configure(authConfig);
          // Mode mock : best-effort (démarre sans Keycloak). Live : connexion exigée (§4.5).
          return environment.useMocks
            ? oauth.loadDiscoveryDocumentAndTryLogin().catch(() => true)
            : oauth.loadDiscoveryDocumentAndLogin();
        }),
      ],
    }),
  )
  .catch((err) => console.error(err));
