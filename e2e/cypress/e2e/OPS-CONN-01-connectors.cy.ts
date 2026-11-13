/**
 * OPS-CONN-01 — Connecteurs ERP (Admin Système, §2.3). Santé, détail, actions pilotées par le serveur,
 * journal d'exécution. Servi par les mocks MSW. Sélecteurs `data-cy` uniquement (D36).
 */
describe('OPS-CONN-01 — Connecteurs', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('liste les connecteurs avec leur santé', () => {
    cy.visit('/connectors');
    cy.get('[data-cy=connector-row]').should('have.length', 2);
    cy.get('[data-cy=connectors-table]').should('contain', 'ERP-CORE').and('contain', 'DOWN');
  });

  it('affiche le détail et le journal d’exécution', () => {
    cy.visit('/connectors');
    cy.get('[data-cy=connector-row]').first().click();
    cy.get('[data-cy=connector-detail]').should('contain', 'ERP-CORE');
    cy.get('[data-cy=execution-row]').should('have.length', 3);
  });

  it('teste la connexion, et exige un motif pour désactiver', () => {
    cy.visit('/connectors');
    cy.get('[data-cy=connector-row]').first().click();
    cy.get('[data-cy=connector-action-disable]').should('be.disabled');
    cy.get('[data-cy=connector-action-test]').click();
    cy.get('[data-cy=connector-test-result]').should('contain', '91 ms');
    cy.get('[data-cy=connector-reason]').type('maintenance', { force: true });
    cy.get('[data-cy=connector-action-disable]').should('be.enabled').click();
    cy.get('[data-cy=connector-action-enable]').should('exist');
  });
});
