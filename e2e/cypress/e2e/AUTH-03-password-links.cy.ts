/** AUTH-03 — liens « changer le mot de passe » et « mot de passe oublié » (auth.yaml v0.3.0, ADR 0014 c). */
describe('AUTH-03 — password links (admin)', () => {
  // Attend que le service worker MSW réponde (sinon le dev-server répond 403 aux /api/auth/*).
  const ready = (w: Window, n = 40): Promise<void> =>
    w.fetch('/api/auth/options?app=admin').then((r) => (r.ok ? r.json().then((b) => (b.mode ? undefined : Promise.reject(new Error('msw')))) : Promise.reject(new Error('msw'))))
      .catch(() => (n > 0 ? new Promise<void>((res) => setTimeout(res, 250)).then(() => ready(w, n - 1)) : Promise.reject(new Error('MSW not ready'))));
  const authorize = (w: Window, qs: string) => w.fetch(`/api/auth/authorize?app=admin&returnTo=/&${qs}`, { redirect: 'manual' });

  it('change password: lien vers /authorize?action=update-password avec returnTo courant', () => {
    cy.visit('/');
    cy.window().then((w) => ready(w).then(() => authorize(w, ''))).then(() => cy.window()).then((w) => {
      // Navigation SPA (l'état de session du mock vit dans la page : pas de rechargement).
      w.history.pushState({}, '', '/login?returnTo=%2Fusers'); // le login relit la session puis renvoie vers returnTo
      w.dispatchEvent(new PopStateEvent('popstate'));
    });
    cy.get('[data-cy=change-password]').should('have.attr', 'href').and('include', 'app=admin')
      .and('include', 'action=update-password').and('include', 'returnTo=%2Fusers');
  });

  it('forgot password: lien visible sur la page de connexion', () => {
    cy.visit('/login');
    cy.get('[data-cy=forgot-password]').should('have.attr', 'href').and('include', '/api/auth/authorize?app=admin');
  });

  it('mock /authorize: action inconnue → 400, update-password accepté', () => {
    cy.visit('/');
    cy.window().then((w) => ready(w).then(() => authorize(w, 'action=bogus'))).its('status').should('eq', 400);
    cy.window().then((w) => authorize(w, 'action=update-password')).its('status').should('not.eq', 400);
  });
});
