/**
 * OPS-08 — Recherche de logs (Admin Système, §10.8). Route `/logs` : flux technique / sécurité, filtres, détail d'une
 * ligne, requêtes sauvegardées, et onglet « Niveaux de log » (surcharges temporaires avec motif). Servi par les mocks
 * MSW. Sélecteurs `data-cy` (D36).
 */
describe('OPS-08 — Recherche de logs', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('liste les logs techniques de la dernière heure, ERROR en tête de flux', () => {
    cy.visit('/logs');
    cy.get('[data-cy=log-row]').should('have.length', 4);
    cy.get('[data-cy=logs-table]').should('contain', 'CTN-INT-0102');
    cy.get('[data-cy=logs-count]').should('contain', '4 résultat(s)');
  });

  it('filtre par niveau', () => {
    cy.visit('/logs');
    cy.get('[data-cy=logs-levels]').select(['ERROR']);
    cy.get('[data-cy=logs-search]').click();
    cy.get('[data-cy=log-row]').should('have.length', 1);
    cy.get('[data-cy=log-level]').should('have.text', 'ERROR');
  });

  it('bascule sur le flux sécurité', () => {
    cy.visit('/logs');
    cy.get('[data-cy=logs-stream]').select('SECURITY');
    cy.get('[data-cy=logs-search]').click();
    cy.get('[data-cy=log-row]').should('have.length', 1);
    cy.get('[data-cy=logs-table]').should('contain', 'Surcharge de niveau activée');
  });

  it('affiche un message quand aucun log ne correspond au texte', () => {
    cy.visit('/logs');
    cy.get('[data-cy=logs-text]').type('introuvable-xyz');
    cy.get('[data-cy=logs-search]').click();
    cy.get('[data-cy=logs-empty]').should('contain', 'Aucun log');
    cy.get('[data-cy=log-row]').should('not.exist');
  });

  it('affiche le détail JSON de la ligne sélectionnée avec sa référence de trace', () => {
    cy.visit('/logs');
    cy.get('[data-cy=log-row]').first().click();
    cy.get('[data-cy=log-detail]').should('contain', '4bf92f3577b34da6').and('contain', 'continuum.integration');
  });

  it('applique une requête sauvegardée', () => {
    cy.visit('/logs');
    cy.get('[data-cy=logs-saved-select]').select('Erreurs d’intégration');
    cy.get('[data-cy=logs-saved-apply]').click();
    cy.get('[data-cy=log-row]').should('have.length', 2);
    cy.get('[data-cy=log-level]').then(($levels) => {
      expect([...$levels].map((el) => el.textContent)).to.deep.equal(['ERROR', 'WARN']);
    });
  });

  it('sauvegarde la requête courante', () => {
    cy.visit('/logs');
    cy.get('[data-cy=logs-text]').type('connecteur');
    cy.get('[data-cy=logs-save-label]').type('Connecteurs');
    cy.get('[data-cy=logs-save]').click();
    cy.get('[data-cy=logs-result]').should('contain', 'Requête « Connecteurs » sauvegardée');
    cy.get('[data-cy=logs-saved-select] option').should('contain', 'Connecteurs');
  });

  it('liste les surcharges de niveau actives avec leur expiration', () => {
    cy.visit('/logs');
    cy.contains('.mat-mdc-tab', 'Niveaux de log').click();
    cy.get('[data-cy=level-row]').should('have.length', 1);
    cy.get('[data-cy=level-value]').should('have.text', 'DEBUG');
    cy.get('[data-cy=level-expires]').should('not.be.empty');
  });

  it('exige un motif d’au moins 10 caractères avant d’activer un niveau', () => {
    cy.visit('/logs');
    cy.contains('.mat-mdc-tab', 'Niveaux de log').click();
    cy.get('[data-cy=level-submit]').should('be.disabled');
    cy.get('[data-cy=level-logger]').type('continuum.iam');
    cy.get('[data-cy=level-reason]').type('court');
    cy.get('[data-cy=level-submit]').should('be.disabled');
  });

  it('active un niveau temporaire et le fait apparaître dans la liste', () => {
    cy.visit('/logs');
    cy.contains('.mat-mdc-tab', 'Niveaux de log').click();
    cy.get('[data-cy=level-logger]').type('continuum.iam');
    cy.get('[data-cy=level-select]').select('WARN');
    cy.get('[data-cy=level-duration]').select('PT1H');
    cy.get('[data-cy=level-reason]').type('Diagnostic des affectations');
    cy.get('[data-cy=level-submit]').click();
    cy.get('[data-cy=logs-result]').should('contain', 'Niveau WARN actif sur continuum.iam');
    cy.get('[data-cy=level-row]').should('have.length', 2).and('contain', 'continuum.iam');
    cy.get('[data-cy=level-reason]').should('have.value', '');
  });
});
