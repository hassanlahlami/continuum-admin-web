import 'cypress-axe';

/**
 * ADM-01 — Accueil Admin Système (§1.2) : tableau de bord lu via `getAdminOverview` (route `/`), servi par les mocks
 * MSW. Les états refus / panne / lenteur sont pilotés par la clé localStorage `ct-mock-overview`. Sélecteurs `data-cy` (D36).
 */
const KEY = 'ct-mock-overview';
const withMode = (mode: string) => ({ onBeforeLoad: (w: Window) => w.localStorage.setItem(KEY, mode) });

describe('ADM-01 — Accueil Admin Système', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('affiche les neuf indicateurs et le bandeau de l’entité en cours', () => {
    cy.visit('/');
    cy.get('[data-cy=overview-entity-name]').should('not.be.empty');
    cy.get('[data-cy=overview-tiles] mat-card').should('have.length', 9);
    cy.get('[data-cy=tile-health] [data-cy=tile-value]').should('have.text', 'Dégradé');
    cy.get('[data-cy=tile-open-alerts] [data-cy=tile-value]').should('have.text', '5');
    cy.get('[data-cy=tile-users-without-assignment] [data-cy=tile-value]').should('have.text', '7');
    cy.get('[data-cy=tile-static-sod-conflicts] [data-cy=tile-value]').should('have.text', '0');
    cy.get('[data-cy=tile-connectors-down] [data-cy=tile-value]').should('have.text', '2');
    cy.get('[data-cy=tile-license-expires] [data-cy=tile-value]').should('not.have.text', '—');
    cy.get('[data-cy=tile-last-directory-sync] [data-cy=tile-value]').should('not.have.text', '—');
  });

  it('ouvre la page correspondante pour les indicateurs dont la page existe', () => {
    cy.visit('/');
    cy.get('[data-cy=tile-connectors-down] [data-cy=tile-link]').click();
    cy.location('pathname').should('eq', '/connectors');
    cy.visit('/');
    cy.get('[data-cy=tile-users-without-assignment] [data-cy=tile-link]').click();
    cy.location('pathname').should('eq', '/users');
  });

  it('n’offre aucun lien pour les pages pas encore disponibles', () => {
    cy.visit('/');
    cy.get('[data-cy=tile-open-alerts] [data-cy=tile-link]').should('not.exist');
    cy.get('[data-cy=tile-open-alerts] [data-cy=tile-nolink]').should('exist');
  });

  it('indique le chargement pendant la réponse', () => {
    cy.visit('/', withMode('slow'));
    cy.get('[data-cy=overview-loading]').should('be.visible');
    cy.get('[data-cy=overview-tiles]').should('exist');
    cy.get('[data-cy=overview-loading]').should('not.exist');
  });

  it('signale une erreur de chargement', () => {
    cy.visit('/', withMode('error'));
    cy.get('[data-cy=overview-error]').should('contain', 'Impossible de charger');
    cy.get('[data-cy=overview-tiles]').should('not.exist');
  });

  it('affiche le refus serveur (403)', () => {
    cy.visit('/', withMode('forbidden'));
    cy.get('[data-cy=overview-error]').should('contain', 'Accès refusé');
    cy.get('[data-cy=overview-tiles]').should('not.exist');
  });

  it('est accessible (axe) et se met en page en RTL', () => {
    cy.visit('/');
    cy.get('[data-cy=overview-tiles]').should('exist');
    cy.injectAxe();
    cy.checkA11y('[data-cy=overview-tiles]');
    cy.document().then((d) => (d.documentElement.dir = 'rtl'));
    cy.get('[data-cy=overview-entity]').should('be.visible');
    cy.get('[data-cy=tile-health]').should('be.visible');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
    cy.checkA11y('[data-cy=overview-tiles]');
  });
});
