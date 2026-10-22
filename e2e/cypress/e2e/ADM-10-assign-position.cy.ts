/**
 * ADM-10 — Affectations : « Affecter une position » (route `/`). L'administrateur octroie une position ;
 * le serveur décide (anti-auto-octroi, SoD statique). Le front n'enforce aucune règle : il affiche la
 * décision. Servi par les mocks MSW (sans backend ni Keycloak).
 */
describe('ADM-10 — Affecter une position', () => {
  const sodUser = '00000000-0000-0000-0000-000000000409';
  const invalidUser = '00000000-0000-0000-0000-000000000422';

  it('crée une affectation (décision serveur : acceptée)', () => {
    cy.visit('/assignments');
    cy.get('[data-cy=assign-submit]').click();
    cy.get('[data-cy=assign-ok]').should('contain', 'Affectation créée').and('contain', 'ACTIVE');
    cy.get('[data-cy=assign-error]').should('not.exist');
  });

  it('affiche le refus SoD statique (409) décidé par le serveur', () => {
    cy.visit('/assignments');
    cy.get('[data-cy=assign-user]').clear().type(sodUser);
    cy.get('[data-cy=assign-submit]').click();
    cy.get('[data-cy=assign-error]').should('contain', '409').and('contain', 'SoD');
    cy.get('[data-cy=assign-ok]').should('not.exist');
  });

  it('bascule le thème (clair / sombre)', () => {
    cy.visit('/assignments');
    cy.get('[data-cy=theme-toggle]').click(); // auto -> clair
    cy.get('html').should('have.attr', 'data-theme', 'light');
    cy.get('[data-cy=theme-toggle]').click(); // clair -> sombre
    cy.get('html').should('have.attr', 'data-theme', 'dark');
  });

  it('affiche le refus de validation / auto-octroi (422)', () => {
    cy.visit('/assignments');
    cy.get('[data-cy=assign-user]').clear().type(invalidUser);
    cy.get('[data-cy=assign-submit]').click();
    cy.get('[data-cy=assign-error]').should('contain', '422').and('contain', 'octroi');
  });
});
