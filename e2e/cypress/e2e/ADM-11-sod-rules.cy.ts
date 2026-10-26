import 'cypress-axe';

/**
 * ADM-11 — Règles de séparation des tâches (route `/sod-rules`) : `listSodRules`, `createSodRule`, `updateSodRule`,
 * `deleteSodRule`, `listSodConflicts`, servis par les mocks MSW. Les refus sont pilotés par la clé localStorage
 * `ct-mock-sod` (`forbidden`, `conflict`, `error`). Sélecteurs `data-cy` (D36).
 */
const KEY = 'ct-mock-sod';
const withMode = (mode: string) => ({ onBeforeLoad: (w: Window) => w.localStorage.setItem(KEY, mode) });

describe('ADM-11 — Règles de séparation des tâches', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('liste les règles avec type et sévérité', () => {
    cy.visit('/sod-rules');
    cy.get('[data-cy=sod-rule]').should('have.length', 2);
    cy.get('[data-cy=sod-rule]').first().should('contain', 'finding.write').and('contain', 'Statique').and('contain', 'Bloquer');
    cy.get('[data-cy=sod-rule]').last().should('contain', 'Dynamique').and('contain', 'Avertir');
  });

  it('affiche les conflits actuels', () => {
    cy.visit('/sod-rules');
    cy.contains('[role=tab]', 'Conflits actuels').click();
    cy.get('[data-cy=sod-conflict]').should('have.length', 1).and('contain', 'Inès Gendron');
  });

  it('crée une règle', () => {
    cy.visit('/sod-rules');
    cy.get('[data-cy=sod-new]').click();
    cy.get('[data-cy=sod-save]').should('be.disabled');
    cy.get('[data-cy=sod-feature-a]').type('audit.plan');
    cy.get('[data-cy=sod-feature-b]').type('audit.close');
    cy.get('[data-cy=sod-save]').click();
    cy.get('[data-cy=sod-message]').should('contain', 'enregistrée');
    cy.get('[data-cy=sod-rule]').should('have.length', 3).and('contain', 'audit.plan');
  });

  it('modifie une règle', () => {
    cy.visit('/sod-rules');
    cy.get('[data-cy=sod-edit]').last().click();
    cy.get('[data-cy=sod-severity]').select('BLOCK');
    cy.get('[data-cy=sod-save]').click();
    cy.get('[data-cy=sod-message]').should('contain', 'enregistrée');
  });

  it('soumet la suppression à double validation', () => {
    cy.visit('/sod-rules');
    cy.get('[data-cy=sod-delete]').first().click();
    cy.get('[data-cy=sod-message]').should('contain', 'double validation');
    cy.get('[data-cy=sod-rule]').should('have.length.gte', 2);
  });

  it('refuse une règle invalide (422)', () => {
    cy.visit('/sod-rules');
    cy.get('[data-cy=sod-new]').click();
    cy.get('[data-cy=sod-feature-a]').type('x.same');
    cy.get('[data-cy=sod-feature-b]').type('x.same');
    cy.get('[data-cy=sod-save]').click();
    cy.get('[data-cy=sod-error]').should('contain', 'invalide');
  });

  it('affiche le refus serveur (403)', () => {
    cy.visit('/sod-rules', withMode('forbidden'));
    cy.get('[data-cy=sod-error]').should('contain', 'Accès refusé');
    cy.get('[data-cy=sod-rules]').should('not.exist');
  });

  it('gère le conflit de version (409) en rechargeant', () => {
    cy.visit('/sod-rules', withMode('conflict'));
    cy.get('[data-cy=sod-edit]').first().click();
    cy.get('[data-cy=sod-save]').click();
    cy.get('[data-cy=sod-error]').should('contain', 'modifiée entre-temps');
    cy.get('[data-cy=sod-form]').should('not.exist');
  });

  it('est accessible depuis la navigation', () => {
    cy.visit('/');
    cy.get('[data-cy=nav-sod-rules]').click();
    cy.url().should('include', '/sod-rules');
  });

  it('est accessible (axe) et se met en page en RTL', () => {
    cy.visit('/sod-rules');
    cy.get('[data-cy=sod-rules]').should('exist');
    cy.injectAxe();
    cy.checkA11y('[data-cy=sod-rules]');
    cy.get('[data-cy=sod-new]').click();
    cy.checkA11y('[data-cy=sod-form]');
    cy.document().then((d) => (d.documentElement.dir = 'rtl'));
    cy.get('[data-cy=sod-rules]').should('be.visible');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
    cy.checkA11y('[data-cy=sod-rules]');
  });
});
