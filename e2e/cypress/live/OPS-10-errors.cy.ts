/**
 * OPS-10 — Erreurs et alertes, mode live (vrai backend, session Keycloak). Aucune donnée supposée : la règle
 * de test est créée avec un libellé unique, modifiée, (dés)activée puis supprimée (la base reste inchangée).
 */
const rulesTab = () => cy.contains('[role=tab]', "Règles d'alerte").click();
const rowOf = (label: string) => cy.contains('[data-cy=rule-row]', label);

describe('OPS-10 — Erreurs et alertes (live)', () => {
  const label = `E2E règle ${Date.now()}`;

  beforeEach(() => {
    cy.viewport(1280, 800);
    cy.loginKeycloak();
    cy.visit('/errors');
  });

  it('charge les erreurs et les règles sans erreur', () => {
    cy.get('[data-cy=errors-error]').should('not.exist');
    rulesTab();
    cy.get('[data-cy=rules-error]').should('not.exist');
    cy.get('[data-cy=rule-form]').should('exist');
  });

  it('crée, désactive/active, modifie puis supprime une règle', () => {
    rulesTab();
    cy.get('[data-cy=rule-form-label]').type(label, { force: true });
    cy.get('[data-cy=rule-form-code]').type('CTN-INT-0200', { force: true });
    cy.get('[data-cy=rule-form-submit]').click();
    cy.get('[data-cy=errors-result]').should('contain', 'créée');
    rowOf(label).find('[data-cy=rule-enabled]').should('have.text', 'Oui');

    // the server only offers edit/delete (availableActions): toggling goes through the edit form
    rowOf(label).find('[data-cy=rule-edit]').click();
    cy.get('[data-cy=rule-form-enabled]').uncheck({ force: true });
    cy.get('[data-cy=rule-form-submit]').click();
    rowOf(label).find('[data-cy=rule-enabled]').should('have.text', 'Non');

    rowOf(label).find('[data-cy=rule-edit]').click();
    cy.get('[data-cy=rule-form-enabled]').check({ force: true });
    cy.get('[data-cy=rule-form-label]').clear({ force: true }).type(`${label} v2`, { force: true });
    cy.get('[data-cy=rule-form-submit]').click();
    rowOf(`${label} v2`).should('exist');

    rowOf(`${label} v2`).find('[data-cy=rule-delete]').click();
    cy.contains('[data-cy=rule-row]', `${label} v2`).should('not.exist');
  });
});
