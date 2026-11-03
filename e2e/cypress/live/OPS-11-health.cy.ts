/**
 * OPS-11 — Supervision, mode live (vrai backend, session Keycloak). Lecture seule : GET /health uniquement ;
 * aucune valeur de composant supposée, seulement la structure rendue.
 */
describe('OPS-11 — Supervision (live)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.loginKeycloak();
    cy.visit('/health');
  });

  it('affiche la santé réelle des composants renvoyée par getPlatformHealth', () => {
    cy.get('[data-cy=health-error]').should('not.exist');
    cy.get('[data-cy=health-row]', { timeout: 20000 }).should('have.length.at.least', 1);
    cy.get('[data-cy=health-status]').each(($s) => expect($s.attr('data-status')).to.match(/^(UP|DEGRADED|DOWN|UNKNOWN)$/));
  });

  it('ne propose aucune action sur les travaux planifiés', () => {
    cy.get('[data-cy=health-row]', { timeout: 20000 }).should('exist');
    cy.get('[data-cy=jobs-table] button').should('not.exist');
  });
});
