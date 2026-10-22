/**
 * USR-01 — Utilisateurs (Admin Système IAM, §2.1) : annuaire filtrable (route `/`), fiche/profil
 * (`/users/:id`) et création d'un compte local (`/users/new`). Servi par les mocks MSW (sans backend
 * ni Keycloak). Le serveur décide (unicité → 409) ; le front affiche. Sélecteurs `data-cy` (D36).
 */
describe('USR-01 — Utilisateurs', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('affiche l’annuaire (parcours nominal)', () => {
    cy.visit('/');
    cy.get('[data-cy=users-table]').should('exist');
    cy.get('[data-cy=user-row]').should('have.length', 7);
    cy.get('[data-cy=users-table]').should('contain', 'Inès Gendron').and('contain', 'ines.gendron');
  });

  it('filtre par statut (reflété dans l’URL, filtrage serveur)', () => {
    cy.visit('/');
    cy.get('[data-cy=users-status]').click();
    cy.get('mat-option').contains('Verrouillé').click();
    cy.get('[data-cy=users-apply]').click();
    cy.url().should('include', 'status=LOCKED');
    cy.get('[data-cy=user-row]').should('have.length', 1);
    cy.get('[data-cy=users-table]').should('contain', 'Salma Benali');
  });

  it('ouvre le profil d’un utilisateur (identité + affectations)', () => {
    cy.visit('/');
    cy.get('[data-cy=user-row]').first().click();
    cy.url().should('match', /\/users\/[0-9a-f-]+$/);
    cy.get('[data-cy=user-name]').should('contain', 'Inès Gendron');
    cy.get('[data-cy=user-status]').should('contain', 'Actif');
    cy.get('[data-cy=user-assignments]').should('contain', 'Chef de mission');
  });

  it('crée un compte local puis affiche son profil', () => {
    cy.visit('/');
    cy.get('[data-cy=users-create]').click();
    cy.location('pathname').should('eq', '/users/new');
    cy.get('[data-cy=create-firstname]').type('Nadia');
    cy.get('[data-cy=create-lastname]').type('Cherkaoui');
    cy.get('[data-cy=create-username]').type('nadia.cherkaoui');
    cy.get('[data-cy=create-email]').type('nadia.cherkaoui@banque-demo.test');
    cy.get('[data-cy=create-submit]').click();
    cy.url().should('match', /\/users\/[0-9a-f-]+$/);
    cy.get('[data-cy=user-name]').should('contain', 'Nadia Cherkaoui');
  });

  it('affiche le refus d’unicité (409) décidé par le serveur', () => {
    cy.visit('/users/new');
    cy.get('[data-cy=create-firstname]').type('Test');
    cy.get('[data-cy=create-lastname]').type('Doublon');
    cy.get('[data-cy=create-username]').type('existant');
    cy.get('[data-cy=create-email]').type('existant@banque-demo.test');
    cy.get('[data-cy=create-submit]').click();
    cy.get('[data-cy=create-error]').should('contain', 'déjà');
    cy.location('pathname').should('eq', '/users/new');
  });
});
