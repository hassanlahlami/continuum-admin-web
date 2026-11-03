/**
 * Support des specs live : commande `cy.loginKeycloak()` (POST /api/auth/login du BFF avec X-XSRF-TOKEN, session mise en cache). Identifiants : CYPRESS_ADM_USER (défaut dsi.admin) et CYPRESS_ADM_PASSWORD (obligatoire).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      loginKeycloak(): Chainable<void>;
    }
  }
}

/** Login BFF (D41) : GET /api/auth/session pose le cookie XSRF-TOKEN, puis POST /api/auth/login (X-XSRF-TOKEN) pose le cookie de session HttpOnly ; cy.session conserve les cookies. */
Cypress.Commands.add('loginKeycloak', () => {
  const user = Cypress.env('ADM_USER') ?? 'dsi.admin';
  const password = Cypress.env('ADM_PASSWORD');
  if (!password) throw new Error('CYPRESS_ADM_PASSWORD is required for live specs');
  cy.session(
    ['bff', user],
    () => {
      cy.request('GET', '/api/auth/session?app=admin')
        .then(() => cy.getCookie('XSRF-TOKEN'))
        .then((xsrf) => {
          if (!xsrf) throw new Error('XSRF-TOKEN cookie not set by GET /api/auth/session');
          return cy.request({
            method: 'POST', url: '/api/auth/login',
            headers: { 'X-XSRF-TOKEN': decodeURIComponent(xsrf.value) },
            body: { app: 'admin', entity: Cypress.env('ADM_ENTITY') ?? 'dss', username: user, password },
          });
        })
        .then((res) => {
          expect(res.status).to.eq(200);
          expect(res.body.status, 'login status').to.eq('AUTHENTICATED');
        });
      cy.visit('/');
      cy.get('[data-cy]', { timeout: 20000 }).should('exist');
    },
    { cacheAcrossSpecs: true },
  );
});

export {};
