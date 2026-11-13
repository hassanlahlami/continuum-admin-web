/**
 * OPS-02 — Connecteur : configuration, mapping et journal. Servi par les mocks MSW.
 * Sélecteurs `data-cy` uniquement (D36).
 */
describe('OPS-02 — Connecteur (détail)', () => {
  const ID = '00000000-0000-0000-0000-0000000000c1';
  beforeEach(() => cy.viewport(1280, 800));

  it('ouvre le détail depuis la liste et affiche la configuration sans secret', () => {
    cy.visit('/connectors');
    cy.get('[data-cy=connector-row]').first().click();
    cy.get('[data-cy=connector-open]').click();
    cy.get('[data-cy=cd-title]').should('contain', 'ERP-CORE');
    cy.get('[data-cy=cd-endpoint]').should('have.value', 'https://erp.example.test/api');
    cy.get('[data-cy=cd-secret-ref]').should('have.value', '');
  });

  it('enregistre la configuration', () => {
    cy.visit(`/connectors/${ID}`);
    cy.get('[data-cy=cd-secret-ref]').type('vault:erp/core', { force: true });
    cy.get('[data-cy=cd-save]').click();
    cy.get('[data-cy=cd-message]').should('contain', 'Configuration enregistrée');
  });

  it('teste la connexion', () => {
    cy.visit(`/connectors/${ID}`);
    cy.get('[data-cy=cd-action-test]').click();
    cy.get('[data-cy=cd-test-result]').should('contain', '91 ms');
  });

  it('bloque l’enregistrement du mapping tant qu’un champ obligatoire n’est pas relié', () => {
    cy.visit(`/connectors/${ID}`);
    cy.get('[data-cy=cd-tab-mapping]').click();
    cy.get('[data-cy=cd-mapping-field]').should('have.length', 3);
    cy.get('[data-cy=cd-mapping-save]').should('be.enabled');
    cy.get('[data-cy=cd-mapping-source]').eq(1).clear();
    cy.get('[data-cy=cd-mapping-missing]').should('contain', 'ACCOUNT.balance');
    cy.get('[data-cy=cd-mapping-save]').should('be.disabled');
    cy.get('[data-cy=cd-mapping-source]').eq(1).type('BALANCE');
    cy.get('[data-cy=cd-mapping-save]').should('be.enabled').click();
    cy.get('[data-cy=cd-message]').should('contain', 'Mapping enregistré');
  });

  it('ouvre la trace depuis une ligne du journal en erreur', () => {
    cy.visit(`/connectors/${ID}`);
    cy.get('[data-cy=cd-tab-journal]').click();
    cy.get('[data-cy=cd-execution-row]').should('have.length', 3);
    cy.get('[data-cy=cd-trace-link]').click();
    cy.location('pathname').should('eq', '/traces/4bf92f3577b34da6a3ce929d0e0e4736');
  });
});
