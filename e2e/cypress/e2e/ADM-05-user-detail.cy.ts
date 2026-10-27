/**
 * ADM-05 — Utilisateur : fiche. Actions de compte proposées par le serveur (`availableActions`),
 * motif obligatoire pour verrouiller / désactiver. Servi par les mocks MSW. Sélecteurs `data-cy` (D36).
 */
describe('ADM-05 — Utilisateur (fiche)', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('affiche identité, affectations et liens', () => {
    cy.visit('/users/00000000-0000-0000-0000-0000000000f1');
    cy.get('[data-cy=user-name]').should('contain', 'Inès Gendron');
    cy.get('[data-cy=user-assignments]').should('contain', 'Chef de mission');
    cy.get('[data-cy=user-assign]').should('have.attr', 'href', '/assignments');
    cy.get('[data-cy=user-effective-rights]').should('have.attr', 'href', '/authz-simulator');
  });

  it('exige un motif pour verrouiller puis déverrouille', () => {
    cy.visit('/users/00000000-0000-0000-0000-0000000000f1');
    cy.get('[data-cy=user-action-lock]').should('be.disabled');
    cy.get('[data-cy=user-reason]').type('Activité suspecte');
    cy.get('[data-cy=user-action-lock]').click();
    cy.get('[data-cy=user-status]').should('contain', 'Verrouillé');
    cy.get('[data-cy=user-action-lock]').should('not.exist');
    cy.get('[data-cy=user-action-unlock]').click();
    cy.get('[data-cy=user-status]').should('contain', 'Actif');
  });

  it('ferme les sessions', () => {
    cy.visit('/users/00000000-0000-0000-0000-0000000000f1');
    cy.get('[data-cy=user-action-close-sessions]').click();
    cy.get('[data-cy=user-message]').should('contain', 'Fermer les sessions');
    cy.get('[data-cy=user-action-close-sessions]').should('not.exist');
  });
});
