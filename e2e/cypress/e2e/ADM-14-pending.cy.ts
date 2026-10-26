import 'cypress-axe';

/**
 * ADM-14 — Demandes en attente de validation (route `/pending`) : `listChangeRequests`, `performChangeRequestAction`,
 * servis par les mocks MSW. Les refus sont pilotés par la clé localStorage `ct-mock-change-requests`
 * (`forbidden`, `conflict`, `error`). Sélecteurs `data-cy` (D36).
 */
const KEY = 'ct-mock-change-requests';
const withMode = (mode: string) => ({ onBeforeLoad: (w: Window) => w.localStorage.setItem(KEY, mode) });

describe('ADM-14 — Demandes en attente de validation', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('liste les demandes avec demandeur, bénéficiaire et fonctionnalités sensibles', () => {
    cy.visit('/pending');
    cy.get('[data-cy=cr-row]').should('have.length', 3);
    cy.get('[data-cy=cr-row]').first().should('contain', 'Affectation').and('contain', 'Inès Gendron').and('contain', 'Inspecteur Deux');
    cy.get('[data-cy=cr-sensitive]').first().should('contain', 'finding.validate');
  });

  it('ne propose aucune action sur la demande de l’utilisateur courant (availableActions)', () => {
    cy.visit('/pending');
    cy.get('[data-cy=cr-row]').eq(1).find('[data-cy=cr-approve], [data-cy=cr-reject]').should('not.exist');
    cy.get('[data-cy=cr-row]').first().find('[data-cy=cr-approve]').should('exist');
  });

  it('approuve une demande', () => {
    cy.visit('/pending');
    cy.get('[data-cy=cr-approve]').first().click();
    cy.get('[data-cy=cr-message]').should('contain', 'approuvée');
    cy.get('[data-cy=cr-row]').should('have.length', 2);
  });

  it('exige un motif pour rejeter, puis rejette', () => {
    cy.visit('/pending');
    cy.get('[data-cy=cr-reject]').first().click();
    cy.get('[data-cy=cr-reject-confirm]').should('be.disabled');
    cy.get('[data-cy=cr-reason]').type('Non justifié');
    cy.get('[data-cy=cr-reject-confirm]').click();
    cy.get('[data-cy=cr-message]').should('contain', 'rejetée');
    cy.get('[data-cy=cr-reject-form]').should('not.exist');
  });

  it('affiche le refus serveur (403)', () => {
    cy.visit('/pending', withMode('forbidden'));
    cy.get('[data-cy=cr-error]').should('contain', 'refusée');
    cy.get('[data-cy=cr-list]').should('not.exist');
  });

  it('gère le conflit (409) en rechargeant', () => {
    cy.visit('/pending', withMode('conflict'));
    cy.get('[data-cy=cr-approve]').first().click();
    cy.get('[data-cy=cr-error]').should('contain', 'entre-temps');
  });

  it('est accessible depuis la navigation', () => {
    cy.visit('/');
    cy.get('[data-cy=nav-pending]').click();
    cy.url().should('include', '/pending');
  });

  it('est accessible (axe) et se met en page en RTL', () => {
    cy.visit('/pending');
    cy.get('[data-cy=cr-list]').should('exist');
    cy.injectAxe();
    cy.checkA11y('[data-cy=cr-list]');
    cy.document().then((d) => (d.documentElement.dir = 'rtl'));
    cy.get('[data-cy=cr-list]').should('be.visible');
    cy.document().its('documentElement.scrollWidth').should('be.lte', 1280);
    cy.checkA11y('[data-cy=cr-list]');
  });
});
