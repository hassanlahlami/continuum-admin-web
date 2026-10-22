/**
 * ADM-10 — Affectations : « Affecter une position » (route `/assignments`). Sélecteurs par libellé
 * (utilisateur / position / unité). L'administrateur octroie une position ; le serveur décide
 * (anti-auto-octroi, SoD statique). Le front n'enforce aucune règle : il affiche la décision.
 * Servi par les mocks MSW (sans backend ni Keycloak).
 */
describe('ADM-10 — Affecter une position', () => {
  // Attend que les données (chargées via MSW) soient là avant d'ouvrir un sélecteur.
  const ready = () => cy.get('[data-cy=assign-row]').should('have.length.greaterThan', 0);

  const pick = (selector: string, text: string) => {
    cy.get(selector).click();
    cy.get('mat-option').should('have.length.greaterThan', 0);
    cy.get('mat-option').contains(text).click();
  };

  it('crée une affectation (décision serveur : acceptée)', () => {
    cy.visit('/assignments');
    ready();
    pick('[data-cy=assign-user]', 'Inès Gendron');
    pick('[data-cy=assign-position]', 'Inspecteur');
    cy.get('[data-cy=assign-submit]').click();
    cy.get('[data-cy=assign-ok]').should('contain', 'Affectation créée').and('contain', 'ACTIVE');
    cy.get('[data-cy=assign-error]').should('not.exist');
  });

  it('affiche le refus SoD statique (409) décidé par le serveur', () => {
    cy.visit('/assignments');
    ready();
    pick('[data-cy=assign-user]', 'Rachid Benjelloun');
    pick('[data-cy=assign-position]', 'Inspecteur');
    cy.get('[data-cy=assign-submit]').click();
    cy.get('[data-cy=assign-error]').should('contain', '409').and('contain', 'SoD');
    cy.get('[data-cy=assign-ok]').should('not.exist');
  });

  it('affiche le refus de validation / auto-octroi (422)', () => {
    cy.visit('/assignments');
    ready();
    pick('[data-cy=assign-user]', 'Fatima Zahra');
    pick('[data-cy=assign-position]', 'Inspecteur');
    cy.get('[data-cy=assign-submit]').click();
    cy.get('[data-cy=assign-error]').should('contain', '422').and('contain', 'octroi');
  });

  it('liste les affectations existantes', () => {
    cy.visit('/assignments');
    cy.get('[data-cy=assign-existing]').should('contain', 'Inès Gendron').and('contain', 'Chef de mission');
  });

  it('bascule le thème (clair / sombre)', () => {
    cy.visit('/assignments');
    cy.get('[data-cy=theme-toggle]').click(); // auto -> clair
    cy.get('html').should('have.attr', 'data-theme', 'light');
    cy.get('[data-cy=theme-toggle]').click(); // clair -> sombre
    cy.get('html').should('have.attr', 'data-theme', 'dark');
  });
});
