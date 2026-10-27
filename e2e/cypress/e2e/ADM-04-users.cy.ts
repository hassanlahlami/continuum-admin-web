/**
 * ADM-04 — Utilisateurs (liste) : bandeau annuaire + synchronisation, colonnes MFA / positions /
 * dernière connexion, filtres unité et position. Servi par les mocks MSW. Sélecteurs `data-cy` (D36).
 */
describe('ADM-04 — Utilisateurs (liste)', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('affiche le bandeau annuaire et déclenche une synchronisation', () => {
    cy.visit('/users');
    cy.get('[data-cy=users-sync-last]').should('contain', '412 importés');
    cy.get('[data-cy=users-sync-error]').should('contain', 'attribut mail manquant');
    cy.get('[data-cy=users-sync-trigger]').click();
    cy.get('[data-cy=users-sync-msg]').should('contain', 'Synchronisation demandée');
  });

  it('affiche MFA et positions dans la liste', () => {
    cy.visit('/users');
    cy.get('[data-cy=user-row]').first().should('contain', 'Chef de mission').find('[data-cy=user-mfa]').should('contain', 'Oui');
  });

  it('filtre par position (reflété dans l’URL)', () => {
    cy.visit('/users');
    cy.get('[data-cy=users-position]').click();
    cy.get('mat-option').contains('Chef de mission').click();
    cy.get('[data-cy=users-apply]').click();
    cy.url().should('include', 'positionId=');
    cy.get('[data-cy=user-row]').should('have.length.at.least', 1).and('contain', 'Chef de mission');
  });

  it('filtre par unité', () => {
    cy.visit('/users');
    cy.get('[data-cy=users-unit]').click();
    cy.get('mat-option').eq(1).click();
    cy.get('[data-cy=users-apply]').click();
    cy.url().should('include', 'unitId=');
  });
});
