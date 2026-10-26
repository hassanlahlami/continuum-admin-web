/**
 * ADM-07 — Positions (Admin Système, §2.1) : liste des positions du tenant (route `/positions`), rang, portée,
 * rattachement et titulaires, lue via `listPositions`. Les positions désactivées sont masquées par défaut
 * (filtre serveur `includeInactive`). Servi par les mocks MSW (sans backend ni Keycloak). Sélecteurs `data-cy` (D36).
 */
describe('ADM-07 — Positions', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('liste les positions actives (parcours nominal)', () => {
    cy.visit('/positions');
    cy.get('[data-cy=positions-table]').should('exist');
    cy.get('[data-cy=position-row]').should('have.length', 3);
    cy.get('[data-cy=positions-table]').should('contain', 'Chef de mission').and('contain', 'Inspecteur');
  });

  it('affiche le libellé seul, jamais le code de la position', () => {
    cy.visit('/positions');
    cy.get('[data-cy=positions-table]').should('not.contain', 'CHEF_MISSION').and('not.contain', 'INSPECTEUR');
  });

  it('affiche le rang, la portée, le rattachement et le nombre de titulaires', () => {
    cy.visit('/positions');
    cy.get('[data-cy=position-row]').contains('Chef de mission').parents('tr').within(() => {
      cy.get('[data-cy=position-rank]').should('have.text', '20');
      cy.get('[data-cy=position-holders]').should('have.text', '1');
      cy.get('td').should('contain', 'Unité et sous-unités').and('contain', 'Administrateur système');
    });
  });

  it('signale le pack et une modification en attente', () => {
    cy.visit('/positions');
    cy.get('[data-cy=position-pack]').should('have.length.greaterThan', 0);
    cy.get('[data-cy=position-pending]').should('contain', 'Modification en attente');
  });

  it('masque les positions désactivées par défaut, les affiche à la demande (filtre serveur)', () => {
    cy.visit('/positions');
    cy.get('[data-cy=positions-table]').should('not.contain', 'Auditeur junior');
    cy.get('[data-cy=positions-include-inactive]').click();
    cy.get('[data-cy=position-row]').should('have.length', 4);
    cy.get('[data-cy=positions-table]').should('contain', 'Auditeur junior').and('contain', 'Désactivée');
  });

  it('bascule le thème (clair / sombre)', () => {
    cy.visit('/positions');
    cy.get('[data-cy=theme-toggle]').click(); // auto -> clair
    cy.get('html').should('have.attr', 'data-theme', 'light');
    cy.get('[data-cy=theme-toggle]').click(); // clair -> sombre
    cy.get('html').should('have.attr', 'data-theme', 'dark');
  });
});
