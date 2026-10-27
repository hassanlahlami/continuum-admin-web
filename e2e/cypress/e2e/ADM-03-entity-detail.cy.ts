import 'cypress-axe';

/**
 * ADM-03 — Entité : fiche (route `/entities/:entityId`) : `getEntity`, `updateEntity`, `performEntityAction`,
 * servis par les mocks MSW. Refus pilotés par la clé localStorage `ct-mock-entities` (`forbidden`, `conflict`). Sélecteurs `data-cy` (D36).
 */
const KEY = 'ct-mock-entities';
const ID = 'e2000000-0000-0000-0000-000000000001';
const withMode = (mode: string) => ({ onBeforeLoad: (w: Window) => w.localStorage.setItem(KEY, mode) });

describe('ADM-03 — Entité : fiche', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('affiche identité, statut, modules et langues', () => {
    cy.visit('/entities/' + ID);
    cy.get('[data-cy=ed-title]').should('contain', 'Maison mère');
    cy.get('[data-cy=ed-identity]').should('contain', 'banque-demo').and('contain', 'PACK-BANQUE');
    cy.get('[data-cy=ed-status]').should('contain', 'Active');
    cy.get('[data-cy=ed-mod-CCM]').should('be.checked');
    cy.get('[data-cy=ed-mod-AI]').should('not.be.checked');
    cy.get('[data-cy=ed-loc-ar]').should('be.checked');
  });

  it('est atteignable depuis la liste', () => {
    cy.visit('/entities');
    cy.get('[data-cy=ent-open]').first().click();
    cy.url().should('include', '/entities/' + ID);
  });

  it('modifie modules et libellé', () => {
    cy.visit('/entities/' + ID);
    cy.get('[data-cy=ed-mod-AI]').check();
    cy.get('[data-cy=ed-label]').clear().type('Maison mère renommée');
    cy.get('[data-cy=ed-save]').click();
    cy.get('[data-cy=ed-message]').should('contain', 'enregistrée');
    cy.get('[data-cy=ed-title]').should('contain', 'renommée');
    cy.get('[data-cy=ed-mod-AI]').should('be.checked');
  });

  it('masque les actions que le serveur ne propose pas', () => {
    cy.visit('/entities/' + ID, withMode('noactions'));
    cy.get('[data-cy=ed-status]').should('contain', 'Active');
    cy.get('[data-cy=ed-suspend]').should('not.exist');
    cy.get('[data-cy=ed-maintenance]').should('not.exist');
  });

  it('suspend puis réactive', () => {
    cy.visit('/entities/' + ID);
    cy.get('[data-cy=ed-suspend]').click();
    cy.get('[data-cy=ed-status]').should('contain', 'Suspendue');
    cy.get('[data-cy=ed-suspend]').should('not.exist');
    cy.get('[data-cy=ed-reactivate]').click();
    cy.get('[data-cy=ed-status]').should('contain', 'Active');
  });

  it('affiche le conflit serveur (409)', () => {
    cy.visit('/entities/' + ID, withMode('conflict'));
    cy.get('[data-cy=ed-save]').click();
    cy.get('[data-cy=ed-error]').should('contain', 'Conflit');
  });

  it('affiche le refus serveur (403)', () => {
    cy.visit('/entities/' + ID, withMode('forbidden'));
    cy.get('[data-cy=ed-error]').should('contain', 'refusée');
    cy.get('[data-cy=ed-identity]').should('not.exist');
  });

  it('est accessible (axe) et se met en page en RTL', () => {
    cy.visit('/entities/' + ID);
    cy.get('[data-cy=ed-identity]').should('exist');
    cy.injectAxe();
    cy.checkA11y('section');
    cy.document().then((d) => (d.documentElement.dir = 'rtl'));
    cy.get('[data-cy=ed-identity]').should('be.visible');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
    cy.checkA11y('section');
  });
});
