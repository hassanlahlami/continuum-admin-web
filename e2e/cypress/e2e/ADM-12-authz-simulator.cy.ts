/**
 * ADM-12 — Simulateur d'habilitations (Admin Système, §2.1) : route `/authz-simulator`. Deux questions servies
 * par les mocks MSW (`simulateAuthorization`, `simulateWhoCan`) : « que peut faire cet utilisateur ? » et
 * « qui peut faire cette action ? ». Le front n'enforce rien : il affiche la décision du serveur. Sélecteurs `data-cy` (D36).
 */
describe('ADM-12 — Simulateur d\'habilitations', () => {
  beforeEach(() => cy.viewport(1280, 800));

  // Attend que les référentiels (MSW) soient chargés avant d'ouvrir un sélecteur.
  const ready = () => cy.get('[data-cy=sim-page][data-ready=true]').should('exist');

  const pick = (selector: string, text: string) => {
    cy.get(selector).click();
    cy.get('mat-option').should('have.length.greaterThan', 0);
    cy.get('mat-option').contains(text).click();
    cy.get('mat-option').should('not.exist');
  };

  it('explique pas à pas qu\'un utilisateur est autorisé (décision serveur)', () => {
    cy.visit('/authz-simulator');
    ready();
    pick('[data-cy=sim-user]', 'Inès Gendron');
    pick('[data-cy=sim-feature]', 'Approuver un rapport');
    cy.get('[data-cy=sim-run]').click();
    cy.get('[data-cy=sim-result]').should('exist');
    cy.get('[data-cy=sim-verdict]').should('contain', 'Autorisé');
    cy.get('[data-cy=sim-step]').should('have.length', 2).and('contain', 'Accorde');
  });

  it('affiche un refus quand la fonctionnalité n\'est pas couverte', () => {
    cy.visit('/authz-simulator');
    ready();
    pick('[data-cy=sim-user]', 'Inès Gendron');
    pick('[data-cy=sim-feature]', 'Gérer les rôles');
    cy.get('[data-cy=sim-run]').click();
    cy.get('[data-cy=sim-verdict]').should('contain', 'Non autorisé');
    cy.get('[data-cy=sim-step]').should('contain', 'Ne couvre pas');
  });

  it('montre le blocage par séparation des tâches décidé par le serveur', () => {
    cy.visit('/authz-simulator');
    ready();
    pick('[data-cy=sim-user]', 'Rachid Benjelloun');
    cy.get('[data-cy=sim-run]').click();
    cy.get('[data-cy=sim-verdict]').should('contain', 'Non autorisé');
    cy.get('[data-cy=sim-step]').should('contain', 'Bloqué (séparation des tâches)');
  });

  it('liste qui peut faire une action sur une ressource (mode « qui peut ? »)', () => {
    cy.visit('/authz-simulator');
    ready();
    cy.get('[data-cy=sim-mode-who]').click();
    pick('[data-cy=sim-who-feature]', 'Approuver un rapport');
    cy.get('[data-cy=sim-resource-id]').type('b1111111-1111-1111-1111-111111111111', { force: true });
    cy.get('[data-cy=sim-who-run]').click();
    cy.get('[data-cy=sim-who-row]').should('have.length', 2).and('contain', 'via Position');
  });

  it('est accessible depuis la navigation', () => {
    cy.visit('/');
    cy.get('[data-cy=nav-authz-simulator]').click();
    cy.url().should('include', '/authz-simulator');
  });
});
