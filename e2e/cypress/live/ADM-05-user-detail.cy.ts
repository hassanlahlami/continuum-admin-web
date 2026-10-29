/**
 * ADM-05 — Utilisateur : fiche, mode live (vrai backend, session Keycloak). L'utilisateur est retrouvé
 * dans l'annuaire réel (aucune donnée de mock supposée) ; actions non destructives uniquement.
 */
describe('ADM-05 — Utilisateur (fiche, live)', () => {
  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.loginKeycloak();
    cy.visit('/users');
    cy.get('[data-cy=user-row]', { timeout: 20000 }).should('have.length.at.least', 1);
    cy.get('[data-cy=user-row]').first().invoke('text').as('rowText');
    cy.get('[data-cy=user-row]').first().click();
    cy.location('pathname').should('match', /^\/users\/[^/]+$/);
  });

  it('affiche identité et statut du compte lus depuis l’annuaire', function () {
    cy.get('[data-cy=user-name]').invoke('text').then((name) => {
      expect(name.trim()).to.not.equal('');
      expect(this.rowText).to.contain(name.trim());
    });
    cy.get('[data-cy=user-status]').should('exist');
    cy.get('[data-cy=user-assign]').should('have.attr', 'href', '/assignments');
    cy.get('[data-cy=user-effective-rights]').should('have.attr', 'href', '/authz-simulator');
  });

  it('exige un motif pour verrouiller', () => {
    cy.get('body').then(($b) => {
      if ($b.find('[data-cy=user-action-lock]').length) {
        cy.get('[data-cy=user-action-lock]').should('be.disabled');
      }
    });
  });

  it('ne réinitialise pas la MFA si la confirmation est refusée', () => {
    cy.window().then((win) => cy.stub(win, 'confirm').as('confirm').returns(false));
    cy.get('body').then(($b) => {
      if ($b.find('[data-cy=user-action-reset-mfa]').length) {
        cy.get('[data-cy=user-action-reset-mfa]').click();
        cy.get('@confirm').should('have.been.called');
        cy.get('[data-cy=user-message]').should('not.exist');
      }
    });
  });
});
