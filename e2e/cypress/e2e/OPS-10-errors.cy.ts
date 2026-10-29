import 'cypress-axe';

/**
 * OPS-10 — Erreurs et alertes (Admin Système). Groupes d'erreurs avec runbook, règles d'alerte (CRUD).
 * Servi par les mocks MSW ; surcharge localStorage `ct-mock-errors` : forbidden, error, empty. Sélecteurs `data-cy` (D36).
 */
const KEY = 'ct-mock-errors';
const withMode = (mode: string) => ({ onBeforeLoad: (w: Window) => w.localStorage.setItem(KEY, mode) });
const rulesTab = () => cy.contains('[role=tab]', "Règles d'alerte").click();

describe('OPS-10 — Erreurs et alertes', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('liste les erreurs groupées par code', () => {
    cy.visit('/errors');
    cy.get('[data-cy=error-row]').should('have.length', 2);
    cy.get('[data-cy=error-code]').first().should('have.text', 'CTN-INT-0102');
    cy.get('[data-cy=error-occurrences]').first().should('have.text', '42');
    cy.get('[data-cy=error-trend]').first().should('contain', '+22');
  });

  it('affiche le runbook d’un code', () => {
    cy.visit('/errors');
    cy.get('[data-cy=error-runbook]').should('not.exist');
    cy.get('[data-cy=error-runbook-toggle]').first().click();
    cy.get('[data-cy=error-runbook]').should('contain', 'Tester la connexion');
  });

  it('ouvre les logs filtrés sur le code', () => {
    cy.visit('/errors');
    cy.get('[data-cy=error-logs-link]').first().click();
    cy.location('pathname').should('eq', '/logs');
    cy.location('search').should('contain', 'code=CTN-INT-0102');
    cy.get('[data-cy=logs-event-codes]').should('have.value', 'CTN-INT-0102');
  });

  it('pilote les boutons depuis availableActions (activer/désactiver)', () => {
    cy.visit('/errors');
    rulesTab();
    cy.get('[data-cy=rule-edit]').should('have.length', 1);
    cy.get('[data-cy=rule-delete]').should('have.length', 1);
    cy.get('[data-cy=rule-disable]').click();
    cy.get('[data-cy=rule-enabled]').first().should('have.text', 'Non');
    cy.get('[data-cy=rule-enable]').should('exist');
  });

  it('crée, modifie et supprime une règle d’alerte', () => {
    cy.visit('/errors');
    rulesTab();
    cy.get('[data-cy=rule-row]').should('have.length', 1);
    cy.get('[data-cy=rule-form-submit]').should('be.disabled');
    cy.get('[data-cy=rule-form-label]').type('ERP lent', { force: true });
    cy.get('[data-cy=rule-form-code]').type('CTN-INT-0200', { force: true });
    cy.get('[data-cy=rule-form-submit]').click();
    cy.get('[data-cy=errors-result]').should('contain', 'créée');
    cy.get('[data-cy=rule-row]').should('have.length', 2);
    cy.get('[data-cy=rule-edit]').last().click();
    cy.get('[data-cy=rule-form-label]').clear({ force: true }).type('ERP très lent', { force: true });
    cy.get('[data-cy=rule-form-submit]').click();
    cy.get('[data-cy=rule-label]').last().should('have.text', 'ERP très lent');
    cy.get('[data-cy=rule-delete]').last().click();
    cy.get('[data-cy=rule-row]').should('have.length', 1);
  });

  it('affiche un état vide', () => {
    cy.visit('/errors', withMode('empty'));
    cy.get('[data-cy=errors-empty]').should('be.visible');
  });

  it('signale une erreur de chargement', () => {
    cy.visit('/errors', withMode('error'));
    cy.get('[data-cy=errors-error]').should('contain', 'Impossible de charger');
  });

  it('refuse l’accès sans les droits (403)', () => {
    cy.visit('/errors', withMode('forbidden'));
    cy.get('[data-cy=errors-error]').should('contain', 'Accès refusé');
    cy.get('[data-cy=errors-table]').should('not.exist');
    rulesTab();
    cy.get('[data-cy=rules-error]').should('contain', 'Accès refusé');
    cy.get('[data-cy=rule-form]').should('not.exist');
  });

  it('est accessible (axe) et se met en page en RTL', () => {
    cy.visit('/errors');
    cy.get('[data-cy=errors-table]').should('exist');
    cy.injectAxe();
    cy.checkA11y('[data-cy=errors-table]');
    cy.document().then((d) => (d.documentElement.dir = 'rtl'));
    cy.get('[data-cy=errors-table]').should('be.visible');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
    cy.checkA11y('[data-cy=errors-table]');
  });
});
