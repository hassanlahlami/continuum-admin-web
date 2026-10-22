/**
 * OPS-AUDIT-01 — Piste d'audit des opérations (Admin Système, §2.3). Journal chaîné « qui/quoi/quand »,
 * recherche multicritère côté serveur reflétée dans l'URL. Servi par les mocks MSW (sans backend).
 * Sélecteurs `data-cy` uniquement (D36).
 */
describe('OPS-AUDIT-01 — Piste d\'audit des opérations', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('affiche le journal des opérations (parcours nominal)', () => {
    cy.visit('/audit-trail');
    cy.get('[data-cy=audit-table]').should('exist');
    cy.get('[data-cy=audit-row]').should('have.length', 4);
    cy.get('[data-cy=audit-table]')
      .should('contain', 'FINDING_VALIDATED')
      .and('contain', 'Inès Gendron')
      .and('contain', 'SOD-VIREMENTS');
  });

  it('déplie le détail avant→après d’un événement', () => {
    cy.visit('/audit-trail');
    cy.get('[data-cy=audit-detail]').should('not.exist');
    cy.get('[data-cy=audit-row]').first().click();
    cy.get('[data-cy=audit-detail]')
      .should('be.visible')
      .and('contain', 'status')
      .and('contain', 'OUVERT')
      .and('contain', 'VALIDATED');
    // deuxième clic : repli
    cy.get('[data-cy=audit-row]').first().click();
    cy.get('[data-cy=audit-detail]').should('not.exist');
  });

  it('filtre par type d’événement (reflété dans l’URL, filtrage serveur)', () => {
    cy.visit('/audit-trail');
    // force: la mat-label flottante recouvre le champ outline vide (quirk Cypress/Material).
    cy.get('[data-cy=audit-event-type]').type('FINDING', { force: true });
    cy.get('[data-cy=audit-apply]').click();
    cy.url().should('include', 'eventType=FINDING');
    cy.get('[data-cy=audit-row]').should('have.length', 1);
    cy.get('[data-cy=audit-table]').should('contain', 'FINDING_VALIDATED');
  });

  it('réinitialise les filtres', () => {
    cy.visit('/audit-trail?eventType=FINDING');
    cy.get('[data-cy=audit-row]').should('have.length', 1);
    cy.get('[data-cy=audit-reset]').click();
    cy.get('[data-cy=audit-row]').should('have.length', 4);
  });

  it('atteint la page depuis la barre latérale', () => {
    cy.visit('/');
    cy.get('[data-cy=nav-audit-trail]').click();
    cy.location('pathname').should('eq', '/audit-trail');
    cy.get('[data-cy=audit-table]').should('exist');
  });
});
