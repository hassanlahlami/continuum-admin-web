import { http, HttpResponse } from 'msw';
import type { LoginOptions, SessionState } from '../api-clients/auth';

/**
 * Mocks MSW du module « auth » (BFF, D41) — Admin Système : mode `redirect` uniquement
 * (spike acr négatif, ADR 0014 avenant). Session tenue en mémoire du handler ; jamais de jeton.
 */
let session: SessionState = { authenticated: false };

const OPTIONS: LoginOptions = { mode: 'redirect', ssoProviders: [], mfaMethods: [] };

export const authHandlers = [
  http.get('*/api/auth/options', () => HttpResponse.json(OPTIONS)),
  http.get('*/api/auth/session', () => HttpResponse.json(session)),
  http.post('*/api/auth/logout', () => {
    session = { authenticated: false };
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/auth/authorize', ({ request }) => {
    session = { authenticated: true, userId: '3f2b8a50-4d4e-4a3a-9a6c-1d2e3f405162', displayName: 'A. Exemple', acr: 1,
      expiresAt: '2099-01-01T00:00:00Z', idleTimeoutSeconds: 1800 };
    return new HttpResponse(null, { status: 302, headers: { Location: new URL(request.url).searchParams.get('returnTo') ?? '/' } });
  }),
  http.get('*/api/auth/step-up', ({ request }) => {
    const acr = Number(new URL(request.url).searchParams.get('acr') ?? 2);
    session = { ...session, acr };
    return new HttpResponse(null, { status: 302, headers: { Location: new URL(request.url).searchParams.get('returnTo') ?? '/' } });
  }),
];
