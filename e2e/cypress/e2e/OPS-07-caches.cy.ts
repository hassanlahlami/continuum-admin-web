/**
 * OPS-07 — Caches de paramétrage (Admin Système, §4.3.4). Régions Ehcache, purge d'une région ou totale avec motif
 * obligatoire et confirmation, résultat « N/N instances purgées ». Servi par les mocks MSW. Sélecteurs `data-cy` (D36).
 */
describe('OPS-07 — Caches de paramétrage', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('liste les régions avec entrées, taux de succès et état par instance', () => {
    cy.visit('/caches');
    cy.get('[data-cy=cache-row]').should('have.length', 3);
    cy.get('[data-cy=caches-table]').should('contain', 'iam-structure').and('contain', '97 %');
    cy.get('[data-cy=cache-instances]').first().should('contain', 'backend-app-1 : 206');
  });

  it('affiche la dernière purge avec son motif', () => {
    cy.visit('/caches');
    cy.get('[data-cy=cache-last-eviction]').first().should('contain', 'Salma Benali').and('contain', 'organigramme');
  });

  it('exige un motif d’au moins 10 caractères avant toute purge', () => {
    cy.visit('/caches');
    cy.get('[data-cy=cache-purge]').first().should('be.disabled');
    cy.get('[data-cy=caches-purge-all]').should('be.disabled');
    cy.get('[data-cy=caches-reason]').type('court');
    cy.get('[data-cy=cache-purge]').first().should('be.disabled');
  });

  it('purge une région après confirmation et affiche le nombre d’instances purgées', () => {
    cy.visit('/caches');
    cy.on('window:confirm', () => true);
    cy.get('[data-cy=caches-reason]').type('Correction du paramétrage de test');
    cy.get('[data-cy=cache-purge]').eq(1).click();
    cy.get('[data-cy=caches-result]').should('contain', '2/2 instances purgées');
    cy.get('[data-cy=cache-row]').eq(1).find('[data-cy=cache-entries]').should('have.text', '0');
    cy.get('[data-cy=caches-reason]').should('have.value', '');
  });

  it('ne purge pas si la confirmation est refusée', () => {
    cy.visit('/caches');
    cy.on('window:confirm', () => false);
    cy.get('[data-cy=caches-reason]').type('Correction du paramétrage de test');
    cy.get('[data-cy=caches-purge-all]').click();
    cy.get('[data-cy=caches-result]').should('not.exist');
    cy.get('[data-cy=cache-row]').eq(0).find('[data-cy=cache-entries]').should('have.text', '412');
  });
});
