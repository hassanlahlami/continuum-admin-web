import 'cypress-axe';

/**
 * ADM-02 — Entités (route `/entities`) : `listEntities`, `createEntity` (Job 202), servis par les mocks MSW.
 * Les refus sont pilotés par la clé localStorage `ct-mock-entities` (`forbidden`, `invalid`, `error`). Sélecteurs `data-cy` (D36).
 */
const KEY = 'ct-mock-entities';
const withMode = (mode: string) => ({ onBeforeLoad: (w: Window) => w.localStorage.setItem(KEY, mode) });

describe('ADM-02 — Entités', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('liste les entités avec statut, isolation, realm et pack', () => {
    cy.visit('/entities');
    cy.get('[data-cy=ent-row]').should('have.length', 2);
    cy.get('[data-cy=ent-row]').first().should('contain', 'BANQUE-DEMO').and('contain', 'SCHEMA').and('contain', 'PACK-BANQUE');
    cy.get('[data-cy=ent-status]').eq(1).should('contain', 'Suspendue');
  });

  it('crée une entité (Job accepté) et la recharge en provisionnement', () => {
    cy.visit('/entities');
    cy.get('[data-cy=ent-new]').click();
    cy.get('[data-cy=ent-submit]').should('be.disabled');
    cy.get('[data-cy=ent-code]').type('FILIALE-02');
    cy.get('[data-cy=ent-label]').type('Filiale deux');
    cy.get('[data-cy=ent-submit]').click();
    cy.get('[data-cy=ent-message]').should('contain', 'provisionnement');
    cy.get('[data-cy=ent-row]').should('have.length', 3);
    cy.get('[data-cy=ent-status]').last().should('contain', 'Création en cours');
  });

  it('affiche la validation serveur (422)', () => {
    cy.visit('/entities', withMode('invalid'));
    cy.get('[data-cy=ent-new]').click();
    cy.get('[data-cy=ent-code]').type('X');
    cy.get('[data-cy=ent-label]').type('X');
    cy.get('[data-cy=ent-submit]').click();
    cy.get('[data-cy=ent-error]').should('contain', 'invalide');
  });

  it('affiche le refus serveur (403)', () => {
    cy.visit('/entities', withMode('forbidden'));
    cy.get('[data-cy=ent-error]').should('contain', 'refusée');
    cy.get('[data-cy=ent-list]').should('not.exist');
  });

  it('est accessible depuis la navigation', () => {
    cy.visit('/');
    cy.get('[data-cy=nav-entities]').click();
    cy.url().should('include', '/entities');
  });

  it('est accessible (axe) et se met en page en RTL', () => {
    cy.visit('/entities');
    cy.get('[data-cy=ent-list]').should('exist');
    cy.injectAxe();
    cy.checkA11y('[data-cy=ent-list]');
    cy.document().then((d) => (d.documentElement.dir = 'rtl'));
    cy.get('[data-cy=ent-list]').should('be.visible');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
    cy.checkA11y('[data-cy=ent-list]');
  });
});
