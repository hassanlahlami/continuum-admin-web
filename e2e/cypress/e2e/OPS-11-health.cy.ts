import 'cypress-axe';

/**
 * OPS-11 — Supervision (Admin Système). Santé par composant, versions de schéma, travaux planifiés en lecture seule.
 * Servi par les mocks MSW ; surcharge localStorage `ct-mock-health` : forbidden, error, empty, slow. Sélecteurs `data-cy` (D36).
 */
const KEY = 'ct-mock-health';
const withMode = (mode: string) => ({ onBeforeLoad: (w: Window) => w.localStorage.setItem(KEY, mode) });

describe('OPS-11 — Supervision', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('affiche la santé par composant et par instance', () => {
    cy.visit('/health');
    cy.get('[data-cy=health-row]').should('have.length', 4);
    cy.get('[data-cy=health-table]').should('contain', 'pg-primary').and('contain', 'Dégradé');
    cy.get('[data-cy=health-status][data-status=DOWN]').should('contain', 'Hors service');
  });

  it('compare la version de schéma appliquée à la version attendue', () => {
    cy.visit('/health');
    cy.get('[data-cy=schema-row]').should('have.length', 2);
    cy.get('[data-cy=schema-pending]').eq(0).should('have.text', '0');
    cy.get('[data-cy=schema-pending]').eq(1).should('have.text', '2');
  });

  it('liste les travaux planifiés sans action', () => {
    cy.visit('/health');
    cy.get('[data-cy=job-row]').should('have.length', 2);
    cy.get('[data-cy=jobs-table]').should('contain', 'Exécution nocturne');
    cy.get('[data-cy=jobs-table] button').should('not.exist');
  });

  it('indique le chargement pendant la réponse', () => {
    cy.visit('/health', withMode('slow'));
    cy.get('[data-cy=health-loading]').should('be.visible');
    cy.get('[data-cy=health-table]').should('exist');
    cy.get('[data-cy=health-loading]').should('not.exist');
  });

  it('affiche un état vide', () => {
    cy.visit('/health', withMode('empty'));
    cy.get('[data-cy=health-empty]').should('be.visible');
  });

  it('signale une erreur de chargement', () => {
    cy.visit('/health', withMode('error'));
    cy.get('[data-cy=health-error]').should('contain', 'Impossible de charger');
    cy.get('[data-cy=health-table]').should('not.exist');
  });

  it('refuse l’accès sans le droit ops.health.read (403)', () => {
    cy.visit('/health', withMode('forbidden'));
    cy.get('[data-cy=health-error]').should('contain', 'Accès refusé');
    cy.get('[data-cy=health-table]').should('not.exist');
  });

  it('est accessible (axe) et se met en page en RTL', () => {
    cy.visit('/health');
    cy.get('[data-cy=health-table]').should('exist');
    cy.injectAxe();
    cy.checkA11y('[data-cy=health-table]');
    cy.document().then((d) => (d.documentElement.dir = 'rtl'));
    cy.get('[data-cy=health-table]').should('be.visible');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
    cy.checkA11y('[data-cy=health-table]');
  });
});
