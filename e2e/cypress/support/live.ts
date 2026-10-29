/**
 * Support des specs live : commande `cy.loginKeycloak()` (OIDC PKCE via la page Keycloak, session mise
 * en cache). Identifiants : CYPRESS_ADM_USER (défaut dsi.admin) et CYPRESS_ADM_PASSWORD (obligatoire).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      loginKeycloak(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('loginKeycloak', () => {
  const user = Cypress.env('ADM_USER') ?? 'dsi.admin';
  const password = Cypress.env('ADM_PASSWORD');
  if (!password) throw new Error('CYPRESS_ADM_PASSWORD is required for live specs');
  const kc = Cypress.env('KEYCLOAK_ORIGIN');
  cy.session(
    ['keycloak', user],
    () => {
      cy.visit('/');
      cy.origin(kc, { args: { user, password } }, ({ user, password }) => {
        cy.get('#username', { timeout: 20000 }).type(user);
        cy.get('#password').type(password, { log: false });
        cy.get('#kc-login').click();
      });
      cy.location('origin', { timeout: 20000 }).should('eq', Cypress.config('baseUrl'));
      cy.get('[data-cy]', { timeout: 20000 }).should('exist');
    },
    { cacheAcrossSpecs: true },
  );
});

export {};
