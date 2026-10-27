/**
 * AUTH-01 — connexion OIDC (PKCE) via Keycloak, mode live (:4202). Identifiants via l'environnement Cypress.
 */
describe('AUTH-01 login (live)', () => {
  it('logs in through Keycloak and lands on the admin console', () => {
    cy.loginKeycloak();
    cy.visit('/');
    cy.location('origin').should('eq', Cypress.config('baseUrl'));
    cy.get('[data-cy]', { timeout: 20000 }).should('exist');
  });
});
