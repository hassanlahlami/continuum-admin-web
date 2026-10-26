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

  it('masque l’édition sans update-matrix (surcharge lecture seule)', () => {
    cy.visit('/roles', { onBeforeLoad: (win) => win.localStorage.setItem('ct-mock-roles-readonly', 'true') });
    cy.get('[data-cy=roles-matrix]').should('be.visible');
    cy.get('[data-cy=roles-edit]').should('not.exist');
  });

  describe('édition (updateRoleFeatureMatrix)', () => {
    const cell = (role: string, code: string) => `[data-cy="cell-${role}-${code}"] input`;

    it('enregistre un différentiel non sensible (APPLIED) et recharge la matrice', () => {
      cy.visit('/roles');
      cy.get('[data-cy=roles-edit]').click();
      cy.get('[data-cy=roles-save]').should('be.disabled');
      cy.get(cell('AUDITOR', 'admin.user.read')).check({ force: true });
      cy.get('[data-cy=roles-save]').should('contain', '(1)').click();
      cy.get('[data-cy=roles-message]').should('contain', 'enregistrée');
      cy.get('[data-cy=grant-yes]').should('have.length', 4);
    });

    it('soumet à double validation une fonctionnalité sensible', () => {
      cy.visit('/roles');
      cy.get('[data-cy=roles-edit]').click();
      cy.get(cell('AUDITOR', 'admin.role.manage')).check({ force: true });
      cy.get('[data-cy=roles-save]').click();
      cy.get('[data-cy=roles-message]').should('contain', 'double validation');
      cy.get('[data-cy=grant-yes]').should('have.length', 3);
    });

    it('affiche le refus serveur (403) sans appliquer', () => {
      cy.visit('/roles');
      cy.get('[data-cy=roles-edit]').click();
      cy.get(cell('ADMIN', 'admin.role.manage')).uncheck({ force: true });
      cy.get('[data-cy=roles-save]').click();
      cy.get('[data-cy=roles-error]').should('contain', 'refusée');
    });

    it('gère le conflit de version (409) en rechargeant', () => {
      cy.visit('/roles');
      cy.get('[data-cy=roles-edit]').click();
      cy.get(cell('AUDITOR', 'report.approve')).uncheck({ force: true });
      cy.get('[data-cy=roles-save]').click();
      cy.get('[data-cy=roles-error]').should('contain', 'modifiée entre-temps');
      cy.get('[data-cy=roles-save]').should('not.exist');
    });

    it('annule le brouillon', () => {
      cy.visit('/roles');
      cy.get('[data-cy=roles-edit]').click();
      cy.get(cell('ADMIN', 'admin.user.read')).uncheck({ force: true });
      cy.get('[data-cy=roles-cancel]').click();
      cy.get('[data-cy=grant-yes]').should('have.length', 3);
    });
  });
});
