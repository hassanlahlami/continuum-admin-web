/**
 * ADM-09 — Rôles et matrice des fonctionnalités (Admin Système, §2.1) : vue en lecture de la matrice
 * (route `/roles`) lue via `getRoleFeatureMatrix`, servie par les mocks MSW. Sélecteurs `data-cy` (D36).
 */
describe('ADM-09 — Rôles et matrice', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('affiche les rôles en colonnes et les fonctionnalités en lignes (libellés seuls)', () => {
    cy.visit('/roles');
    cy.get('[data-cy=role-col]').should('have.length', 2);
    cy.get('[data-cy=feature-row]').should('have.length', 3);
    cy.get('[data-cy=roles-matrix]').should('contain', 'Administrateur').and('contain', 'Approuver un rapport')
      .and('not.contain', 'admin.role.manage').and('not.contain', 'ADMIN');
  });

  it('marque les droits accordés', () => {
    cy.visit('/roles');
    cy.get('[data-cy=grant-yes]').should('have.length', 3);
  });

  it('signale les fonctionnalités sensibles et les conflits SoD', () => {
    cy.visit('/roles');
    cy.get('[data-cy=feature-sensitive]').should('have.length', 1);
    cy.get('[data-cy=roles-sod-warning]').should('contain', 'Administrateur').and('contain', 'incompatibles');
  });

  it('est accessible depuis la navigation', () => {
    cy.visit('/');
    cy.get('[data-cy=nav-roles]').click();
    cy.url().should('include', '/roles');
  });
});
