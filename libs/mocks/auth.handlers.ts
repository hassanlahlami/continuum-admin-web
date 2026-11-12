import { http, HttpResponse } from 'msw';
import type { AuthProblem, LoginOptions, LoginRequest, MfaRequest, SessionState } from '../api-clients/auth';

/**
 * Mocks MSW du module « auth » (BFF, D41, auth.yaml v0.2.0) — front `admin` (cookie `CT_ADMIN_SESSION`,
 * porté par le navigateur ; jamais de jeton). Session tenue en mémoire du handler.
 *
 * Sentinelles `POST /login` (identifiant) : `locked`/`bad` → 401 invalid-credentials (même réponse, sans énumération) ;
 * `throttled` → 429 + Retry-After ; `mfa` → MFA_REQUIRED (code OTP valide : 123456) ; `action` → ACTION_REQUIRED ;
 * `other-app` → 400 (valeur `app` non exposée par l'instance) ; tout autre → AUTHENTICATED à `acr` = 1
 * (le direct grant ne délivre que acr 1 : les appels `/api/admin/**` répondent alors 401 step-up-required).
 * Surcharge localStorage `ct-mock-login-mode` = `rest` pour proposer le mode REST (sinon `redirect`, défaut admin).
 */
export const LOGIN_MODE_OVERRIDE_KEY = 'ct-mock-login-mode';
export const MOCK_VALID_OTP = '123456';

const USER_ID = '3f2b8a50-4d4e-4a3a-9a6c-1d2e3f405162';
let session: SessionState = { authenticated: false };
let pendingChallenge: string | null = null;

const authed = (acr: number): SessionState => ({
  authenticated: true, userId: USER_ID, displayName: 'A. Exemple', acr, expiresAt: '2099-01-01T00:00:00Z', idleTimeoutSeconds: 1800,
});

const problem = (status: number, reason: AuthProblem.ReasonEnum, title: string, extra: Partial<AuthProblem> = {}, headers: Record<string, string> = {}) =>
  HttpResponse.json({ status, reason, title, traceId: 'mock-trace', ...extra } satisfies AuthProblem,
    { status, headers: { 'content-type': 'application/problem+json', ...headers } });

const options = (): LoginOptions => {
  const rest = globalThis.localStorage?.getItem(LOGIN_MODE_OVERRIDE_KEY) === 'rest';
  return { mode: rest ? 'rest' : 'redirect', ssoProviders: [], mfaMethods: rest ? ['otp'] : [] };
};

/** Cookie XSRF (non HttpOnly) posé/renouvelé par `GET /session` et `POST /login` (double-submit). */
const withXsrf = () => { if (typeof document !== 'undefined') document.cookie = 'XSRF-TOKEN=mock-xsrf; path=/'; };

const redirect = (request: Request) =>
  new HttpResponse(null, { status: 302, headers: { Location: new URL(request.url).searchParams.get('returnTo') ?? '/' } });

export const authHandlers = [
  http.get('*/api/auth/options', ({ request }) =>
    new URL(request.url).searchParams.get('app') === 'app' ? HttpResponse.json({ ...options(), mode: 'redirect' }) : HttpResponse.json(options())),
  http.get('*/api/auth/session', () => { withXsrf(); return HttpResponse.json(session); }),
  http.post('*/api/auth/logout', () => {
    session = { authenticated: false };
    return new HttpResponse(null, { status: 204 });
  }),
  http.post('*/api/auth/login', async ({ request }) => {
    const body = (await request.json()) as LoginRequest;
    if (body.app && body.app !== 'admin') return problem(400, 'unauthenticated', 'Bad request');
    withXsrf();
    if (body.username === 'throttled') return problem(429, 'rate-limited', 'Too many attempts', {}, { 'Retry-After': '30' });
    if (body.username === 'locked' || body.username === 'bad' || body.password === 'wrong') return problem(401, 'invalid-credentials', 'Invalid credentials');
    if (body.username === 'action') return HttpResponse.json({ status: 'ACTION_REQUIRED', redirectUrl: '/api/auth/authorize?app=admin&returnTo=/' });
    if (body.username === 'mfa') {
      pendingChallenge = '9c1f3a52-7d0e-4b1e-8a64-2f5d6e7a8b90';
      return HttpResponse.json({ status: 'MFA_REQUIRED', challengeId: pendingChallenge, methods: ['otp'] });
    }
    session = authed(1);
    return HttpResponse.json({ status: 'AUTHENTICATED', session });
  }),
  http.post('*/api/auth/mfa', async ({ request }) => {
    const body = (await request.json()) as MfaRequest;
    if (!pendingChallenge || body.challengeId !== pendingChallenge || body.code !== MOCK_VALID_OTP) {
      return problem(401, 'invalid-credentials', 'Invalid credentials');
    }
    pendingChallenge = null;
    session = authed(1);
    return HttpResponse.json({ status: 'AUTHENTICATED', session });
  }),
  // Code + PKCE terminé par le BFF : pour `app=admin` la session naît directement au `acr` exigé par /api/admin/** (2).
  http.get('*/api/auth/authorize', ({ request }) => {
    const returnTo = new URL(request.url).searchParams.get('returnTo') ?? '/';
    if (!returnTo.startsWith('/') || returnTo.startsWith('//')) return problem(400, 'unauthenticated', 'Bad request');
    const action = new URL(request.url).searchParams.get('action');
    if (action !== null && action !== 'update-password') return problem(400, 'unauthenticated', 'Bad request');
    session = authed(2);
    return redirect(request);
  }),
  http.get('*/api/auth/step-up', ({ request }) => {
    if (!session.authenticated) return problem(401, 'unauthenticated', 'Unauthenticated');
    session = { ...session, acr: Number(new URL(request.url).searchParams.get('acr') ?? 2) };
    return redirect(request);
  }),
];
