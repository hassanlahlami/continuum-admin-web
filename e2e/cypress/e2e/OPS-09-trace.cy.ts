/**
 * OPS-09 — Trace d'une requête (Admin Système, §10.8). Route `/traces/:traceId` : frise des étapes, étape en erreur
 * avec son code d'événement, logs associés ; saisie directe d'une référence depuis l'en-tête. Mocks MSW. `data-cy` (D36).
 */
describe('OPS-09 — Trace d’une requête', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('affiche la frise des étapes d’une requête en erreur avec le code d’événement', () => {
    cy.visit('/traces/4bf92f3577b34da6a3ce929d0e0e4736');
    cy.get('[data-cy=trace-outcome]').should('contain', 'En erreur');
    cy.get('[data-cy=trace-span]').should('have.length', 4);
    cy.get('[data-cy=span-service]').first().should('contain', 'continuum-app-web');
    cy.get('[data-cy=span-code]').should('have.text', 'CTN-INT-0102');
    cy.get('[data-cy=trace-log]').should('contain', 'ERP-LEGACY');
  });

  it('affiche une requête réussie sans log associé', () => {
    cy.visit('/traces/0af7651916cd43dd8448eb211c80319c');
    cy.get('[data-cy=trace-outcome]').should('contain', 'Réussie');
    cy.get('[data-cy=trace-logs-empty]').should('exist');
  });

  it('signale une référence inconnue', () => {
    cy.visit('/traces/ffffffffffffffffffffffffffffffff');
    cy.get('[data-cy=trace-error]').should('contain', 'Aucune trace');
    cy.get('[data-cy=trace-span]').should('not.exist');
  });

  it('ouvre la trace depuis la saisie de l’en-tête', () => {
    cy.visit('/');
    cy.get('[data-cy=trace-lookup]').type('0af7651916cd43dd8448eb211c80319c{enter}');
    cy.location('pathname').should('eq', '/traces/0af7651916cd43dd8448eb211c80319c');
    cy.get('[data-cy=trace-span]').should('have.length', 2);
  });

  it('le code d’événement mène à OPS-10', () => {
    cy.visit('/traces/4bf92f3577b34da6a3ce929d0e0e4736');
    cy.get('[data-cy=span-code]').click();
    cy.location('pathname').should('eq', '/errors');
  });
});
