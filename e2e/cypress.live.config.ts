import { defineConfig } from 'cypress';

/**
 * Cypress e2e « live » : dev-server `ng serve --configuration live` sur :4202 (vrai backend + Keycloak
 * de la simulation). Identifiants fournis par l'environnement : CYPRESS_ADM_USER / CYPRESS_ADM_PASSWORD
 * (jamais en dur). `npm run e2e:live`.
 */
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:4202',
    specPattern: 'cypress/live/**/*.cy.ts',
    supportFile: 'cypress/support/live.ts',
    fixturesFolder: false,
    video: false,
    screenshotOnRunFailure: false,
    env: { KEYCLOAK_ORIGIN: 'http://localhost:8180' },
  },
});
