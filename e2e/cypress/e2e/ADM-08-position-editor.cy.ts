/**
 * ADM-08 — Position : éditeur (Admin Système, §2.1) : route `/positions/:positionId`. Lecture via `getPosition`,
 * enregistrement via `updatePosition`, désactivation / réactivation via `performPositionAction`. Le serveur décide
 * (double validation pour une fonctionnalité sensible, 403 si la position est occupée par l'administrateur).
 * Servi par les mocks MSW (sans backend ni Keycloak). Sélecteurs `data-cy` (D36).
 */
describe('ADM-08 — Position : éditeur', () => {
  const CHEF_MISSION = 'd1111111-1111-1111-1111-111111111111';
  const ADMIN_SYS = 'd3333333-3333-3333-3333-333333333333';

  beforeEach(() => cy.viewport(1280, 800));

  it('affiche la position, ses fonctionnalités résultantes et ses titulaires (parcours nominal)', () => {
    cy.visit(`/positions/${CHEF_MISSION}`);
    cy.get('[data-cy=position-label-fr]').should('have.value', 'Chef de mission');
    cy.get('[data-cy=position-rank-input]').should('have.value', '20');
    cy.get('[data-cy=position-features]').should('contain', 'report.approve');
    cy.get('[data-cy=position-holders]').should('have.text', '1');
  });

  it('enregistre une modification du rang (décision serveur : acceptée)', () => {
    cy.visit(`/positions/${CHEF_MISSION}`);
    cy.get('[data-cy=position-rank-input]').clear().type('25');
    cy.get('[data-cy=position-save]').click();
    cy.get('[data-cy=position-ok]').should('contain', 'Position enregistrée');
    cy.get('[data-cy=position-error]').should('not.exist');
  });

  it('place en double validation un rôle qui porte une fonctionnalité sensible', () => {
    cy.visit(`/positions/${CHEF_MISSION}`);
    cy.get('[data-cy=position-roles]').click();
    cy.get('mat-option').contains('Administrateur').click();
    cy.get('[data-cy=position-roles]').type('{esc}');
    cy.get('[data-cy=position-save]').click();
    cy.get('[data-cy=position-ok]').should('contain', 'double validation');
    cy.get('[data-cy=position-pending]').should('contain', 'Modification en attente');
    cy.get('[data-cy=position-features]').should('contain', 'admin.role.manage');
  });

  it('désactive puis réactive la position', () => {
    cy.visit(`/positions/${CHEF_MISSION}`);
    cy.get('[data-cy=position-state]').should('contain', 'Active');
    cy.get('[data-cy=position-toggle]').should('contain', 'Désactiver').click();
    cy.get('[data-cy=position-state]').should('contain', 'Désactivée');
    cy.get('[data-cy=position-toggle]').should('contain', 'Réactiver').click();
    cy.get('[data-cy=position-state]').should('contain', 'Active');
  });

  it("affiche le refus 403 lorsque la position est occupée par l'administrateur courant", () => {
    cy.visit(`/positions/${ADMIN_SYS}`);
    cy.get('[data-cy=position-rank-input]').clear().type('11');
    cy.get('[data-cy=position-save]').click();
    cy.get('[data-cy=position-error]').should('contain', 'HTTP 403').and('contain', 'vous occupez cette position');
    cy.get('[data-cy=position-ok]').should('not.exist');
  });

  it('signale une position introuvable', () => {
    cy.visit('/positions/00000000-0000-0000-0000-000000000000');
    cy.get('[data-cy=position-not-found]').should('contain', 'introuvable');
  });

  it('ouvre l’éditeur depuis la liste des positions', () => {
    cy.visit('/positions');
    cy.get('[data-cy=position-link]').contains('Chef de mission').click();
    cy.url().should('include', `/positions/${CHEF_MISSION}`);
    cy.get('[data-cy=position-label-fr]').should('have.value', 'Chef de mission');
  });

  it('bascule le thème (clair / sombre)', () => {
    cy.visit(`/positions/${CHEF_MISSION}`);
    cy.get('[data-cy=theme-toggle]').click(); // auto -> clair
    cy.get('html').should('have.attr', 'data-theme', 'light');
    cy.get('[data-cy=theme-toggle]').click(); // clair -> sombre
    cy.get('html').should('have.attr', 'data-theme', 'dark');
  });
});
