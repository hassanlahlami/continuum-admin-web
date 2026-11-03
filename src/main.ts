import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideRouter } from '@angular/router';
import { catchError, firstValueFrom, of } from 'rxjs';
import { BASE_PATH } from '../libs/api-clients/admin-iam';
import { BASE_PATH as OPERATIONS_BASE_PATH } from '../libs/api-clients/operations';
import { AppComponent } from './app/app.component';
import { routes } from './app/app.routes';
import { AuthFacade } from './app/auth/auth.facade';
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
    // Démarrage best-effort : un Service Worker MSW périmé ou en échec ne doit JAMAIS empêcher
    // l'amorçage de l'application (sinon page blanche). On avertit et on continue sans mocks.
    try {
      const { worker } = await import('./mocks/browser');
      await worker.start({ onUnhandledRequest: 'bypass' });
    } catch (err) {
      console.warn('[MSW] démarrage des mocks impossible — poursuite sans mocks.', err);
    }
  }
}

/**
 * Configuration d'exécution **par installation** (on-premise, D26) : un seul artefact buildé, dont
 * l'issuer OIDC et l'URL d'API sont fixés par `config.json` servi à la racine — édité par l'intégrateur
 * sans reconstruction. Les valeurs du build (`environment.*`) servent de défauts si le fichier est
 * absent ou illisible. Patron identique à `continuum-app-web`.
 */
interface RuntimeConfig {
  oidcIssuer: string;
  apiBaseUrl: string;
}

async function loadRuntimeConfig(): Promise<RuntimeConfig> {
  const defaults: RuntimeConfig = {
    oidcIssuer: environment.oidcIssuer,
    apiBaseUrl: environment.apiBaseUrl,
  };
  try {
    const res = await fetch(new URL('config.json', document.baseURI).href, { cache: 'no-store' });
    if (!res.ok) {
      return defaults;
    }
    const raw = (await res.json()) as Partial<RuntimeConfig>;
    return {
      oidcIssuer: typeof raw.oidcIssuer === 'string' && raw.oidcIssuer ? raw.oidcIssuer : defaults.oidcIssuer,
      apiBaseUrl: typeof raw.apiBaseUrl === 'string' && raw.apiBaseUrl ? raw.apiBaseUrl : defaults.apiBaseUrl,
    };
  } catch {
    return defaults; // config.json absent/illisible : on garde les valeurs du build
  }
}

startMocksInDev()
  .then(loadRuntimeConfig)
  .then((config) =>
    bootstrapApplication(AppComponent, {
      providers: [
        provideHttpClient(withInterceptors([authInterceptor]),
          withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' })),
        provideAnimationsAsync(),
        provideRouter(routes),
        { provide: BASE_PATH, useValue: config.apiBaseUrl },
        { provide: OPERATIONS_BASE_PATH, useValue: config.apiBaseUrl },
        // Charge l'état de session et pose le cookie CSRF avant l'amorçage ; la garde route vers /login.
        provideAppInitializer(() =>
          firstValueFrom(inject(AuthFacade).refresh().pipe(catchError(() => of(undefined)))),
        ),
      ],
    }),
  )
  .catch((err) => console.error(err));
