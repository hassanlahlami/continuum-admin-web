import { defineConfig } from 'cypress';

/**
 * Cypress e2e de la Plateforme Admin Système (D36). Specs contre le dev-server en mode mock (MSW,
 * sans backend ni Keycloak) sur :4201 : `npm run e2e`. Un fichier par identifiant de page,
 * sélecteurs `data-cy` uniquement.
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4201',
    specPattern: 'cypress/e2e/**/*.cy.ts',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: false,
    video: false,
    screenshotOnRunFailure: false,
  },
});
