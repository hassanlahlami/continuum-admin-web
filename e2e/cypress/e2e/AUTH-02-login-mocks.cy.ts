/**
 * AUTH-02 — Mocks MSW du BFF d'authentification (auth.yaml v0.2.0, front `admin`) : /options, /login (union
 * discriminée, 401 sans énumération, 429), /mfa, /session, /logout, /authorize (acr 2) et /step-up.
 */
type Res = { status: number; body: any; retry?: string | null };

describe('AUTH-02 — login mocks (admin)', () => {
  const call = (w: Window, method: string, url: string, json?: unknown) =>
    w.fetch(url, { method, redirect: 'manual', headers: { 'content-type': 'application/json' }, body: json ? JSON.stringify(json) : undefined })
      .then(async (r): Promise<Res> => ({ status: r.status, body: await r.text().then((t) => (t.startsWith('{') ? JSON.parse(t) : t)), retry: r.headers.get('Retry-After') }));
  const login = (w: Window, username: string, password = 'x') => call(w, 'POST', '/api/auth/login', { app: 'admin', username, password });

  // Attend que le service worker MSW réponde (sinon le dev-server répond 403 aux /api/auth/*).
  const ready = (w: Window, n = 40): Promise<void> =>
    w.fetch('/api/auth/options?app=admin').then((r) => (r.ok && r.headers.get('x-msw-mock') !== null ? undefined : r.ok ? r.json().then((b) => (b.mode ? undefined : Promise.reject(new Error('msw')))) : Promise.reject(new Error('msw'))))
      .catch(() => (n > 0 ? new Promise<void>((res) => setTimeout(res, 250)).then(() => ready(w, n - 1)) : Promise.reject(new Error('MSW not ready'))));
  beforeEach(() => { cy.visit('/'); cy.window().then((w) => ready(w)); });

  it('options: redirect par défaut, rest via surcharge', () => {
    cy.window().then((w) => call(w, 'GET', '/api/auth/options?app=admin')).its('body.mode').should('eq', 'redirect');
    cy.window().then((w) => { w.localStorage.setItem('ct-mock-login-mode', 'rest'); return call(w, 'GET', '/api/auth/options?app=admin'); })
      .its('body.mode').should('eq', 'rest');
    cy.window().then((w) => w.localStorage.removeItem('ct-mock-login-mode'));
  });

  it('login: AUTHENTICATED acr=1, puis session et logout', () => {
    cy.window().then((w) => login(w, 'jdoe')).then((r) => { expect(r.status).to.eq(200); expect(r.body.status).to.eq('AUTHENTICATED'); expect(r.body.session.acr).to.eq(1); });
    cy.window().then((w) => call(w, 'GET', '/api/auth/session')).its('body.authenticated').should('eq', true);
    cy.window().then((w) => call(w, 'POST', '/api/auth/logout')).its('status').should('eq', 204);
    cy.window().then((w) => call(w, 'GET', '/api/auth/session')).its('body.authenticated').should('eq', false);
  });

  it('login: identifiants faux et compte verrouillé → même 401, 429 avec Retry-After', () => {
    cy.window().then((w) => login(w, 'bad').then((a) => login(w, 'locked').then((b) => [a, b]))).then(([a, b]) => {
      expect(a.status).to.eq(401); expect(b.status).to.eq(401);
      expect(a.body).to.deep.eq(b.body); expect(a.body.reason).to.eq('invalid-credentials');
    });
    cy.window().then((w) => login(w, 'throttled')).then((r) => { expect(r.status).to.eq(429); expect(r.body.reason).to.eq('rate-limited'); expect(r.retry).to.eq('30'); });
  });

  it('login: MFA_REQUIRED puis /mfa (OTP valide / invalide), ACTION_REQUIRED', () => {
    cy.window().then((w) => login(w, 'mfa').then((r) => {
      expect(r.body.status).to.eq('MFA_REQUIRED');
      return call(w, 'POST', '/api/auth/mfa', { challengeId: r.body.challengeId, code: '000000' }).then((bad) => {
        expect(bad.status).to.eq(401);
        return call(w, 'POST', '/api/auth/mfa', { challengeId: r.body.challengeId, code: '123456' });
      });
    })).then((ok) => { expect(ok.body.status).to.eq('AUTHENTICATED'); });
    cy.window().then((w) => login(w, 'action')).its('body.status').should('eq', 'ACTION_REQUIRED');
  });

  it('login: app non exposée → 400', () => {
    cy.window().then((w) => call(w, 'POST', '/api/auth/login', { app: 'app', username: 'jdoe', password: 'x' })).its('status').should('eq', 400);
  });

  it('authorize pose acr=2 (admin) ; step-up relève le niveau', () => {
    cy.window().then((w) => call(w, 'GET', '/api/auth/authorize?app=admin&returnTo=/entities')
      .then(() => call(w, 'GET', '/api/auth/session'))).its('body.acr').should('eq', 2);
    cy.window().then((w) => login(w, 'jdoe').then(() => call(w, 'GET', '/api/auth/step-up?app=admin&acr=2&returnTo=/'))
      .then(() => call(w, 'GET', '/api/auth/session'))).its('body.acr').should('eq', 2);
  });
});
