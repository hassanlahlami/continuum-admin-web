import 'cypress-axe';

/**
 * ADM-06 — Organigramme (route `/org`) : types d'unités et arbre (`getOrgTree`, `createOrgUnit`, `performOrgUnitAction`,
 * `listUnitTypes`, `createUnitType`), servis par les mocks MSW. Refus pilotés par la clé localStorage `ct-mock-org`
 * (`forbidden`, `conflict`). Sélecteurs `data-cy` (D36).
 */
const KEY = 'ct-mock-org';
const withMode = (mode: string) => ({ onBeforeLoad: (w: Window) => w.localStorage.setItem(KEY, mode) });

describe('ADM-06 — Organigramme', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('affiche l\'arbre avec type et affectations rattachées', () => {
    cy.visit('/org');
    cy.get('[data-cy=org-row]').should('have.length', 3);
    cy.get('[data-cy=org-row]').eq(1).should('contain', 'Agence').and('contain', '5');
  });

  it('filtre par recherche', () => {
    cy.visit('/org');
    cy.get('[data-cy=org-search]').type('risques');
    cy.get('[data-cy=org-row]').should('have.length', 1).and('contain', 'DIR-RISQUES');
  });

  it('crée une unité sous un parent', () => {
    cy.visit('/org');
    cy.get('[data-cy=org-new]').click();
    cy.get('[data-cy=org-submit]').should('be.disabled');
    cy.get('[data-cy=org-code]').type('AG-NORD');
    cy.get('[data-cy=org-label]').type('Agence Nord');
    cy.get('[data-cy=org-type]').select('Agence');
    cy.get('[data-cy=org-parent]').select('Direction des risques');
    cy.get('[data-cy=org-submit]').click();
    cy.get('[data-cy=org-message]').should('contain', 'créée');
    cy.get('[data-cy=org-row]').should('have.length', 4);
  });

  it('affiche l\'impact puis déplace une unité', () => {
    cy.visit('/org');
    cy.get('[data-cy=org-row]').eq(1).find('[data-cy=org-move]').click();
    cy.get('[data-cy=org-impact]').should('contain', '1 unité(s)').and('contain', '5 affectation(s)');
    cy.get('[data-cy=org-confirm-ok]').should('be.disabled');
    cy.get('[data-cy=org-target]').select('Direction des risques');
    cy.get('[data-cy=org-confirm-ok]').click();
    cy.get('[data-cy=org-message]').should('contain', 'déplacée');
    cy.get('[data-cy=org-row]').eq(2).should('contain', 'Agence');
  });

  it('ferme une unité après confirmation, visible via « fermées »', () => {
    cy.visit('/org');
    cy.get('[data-cy=org-row]').eq(2).find('[data-cy=org-close]').click();
    cy.get('[data-cy=org-impact]').should('contain', '2 affectation(s)');
    cy.get('[data-cy=org-confirm-ok]').click();
    cy.get('[data-cy=org-message]').should('contain', 'fermée');
    cy.get('[data-cy=org-row]').should('have.length', 2);
    cy.get('[data-cy=org-closed]').check();
    cy.get('[data-cy=org-closed-badge]').should('exist');
  });

  it('gère les types d\'unités', () => {
    cy.visit('/org');
    cy.get('[data-cy=org-tab-types]').click();
    cy.get('[data-cy=type-row]').should('have.length', 2);
    cy.get('[data-cy=type-code]').type('SERVICE');
    cy.get('[data-cy=type-label]').type('Service');
    cy.get('[data-cy=type-submit]').click();
    cy.get('[data-cy=type-row]').should('have.length', 3);
  });

  it('affiche le conflit serveur (409)', () => {
    cy.visit('/org', withMode('conflict'));
    cy.get('[data-cy=org-row]').eq(1).find('[data-cy=org-close]').click();
    cy.get('[data-cy=org-confirm-ok]').click();
    cy.get('[data-cy=org-error]').should('contain', 'Conflit');
  });

  it('affiche le refus serveur (403)', () => {
    cy.visit('/org', withMode('forbidden'));
    cy.get('[data-cy=org-error]').should('contain', 'refusée');
    cy.get('[data-cy=org-tree]').should('not.exist');
  });

  it('est accessible depuis la navigation', () => {
    cy.visit('/');
    cy.get('[data-cy=nav-org]').click();
    cy.url().should('include', '/org');
  });

  it('est accessible (axe) et se met en page en RTL', () => {
    cy.visit('/org');
    cy.get('[data-cy=org-tree]').should('exist');
    cy.injectAxe();
    cy.checkA11y('[data-cy=org-tree]');
    cy.document().then((d) => (d.documentElement.dir = 'rtl'));
    cy.get('[data-cy=org-tree]').should('be.visible');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
    cy.checkA11y('[data-cy=org-tree]');
  });
});
