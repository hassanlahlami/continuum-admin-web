/**
 * Support des specs live : commande `cy.loginKeycloak()` (POST /api/auth/login du BFF avec X-XSRF-TOKEN, session mise en cache). Identifiants : CYPRESS_ADM_USER (défaut dsi.admin) et CYPRESS_ADM_PASSWORD (obligatoire).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Cypress {
    interface Chainable {
      loginKeycloak(): Chainable<void>;
    }
  }
}

/**
 * Login Code+PKCE admin (ADR 0014) : GET /api/auth/authorize?app=admin demande acr=2 ; la page Keycloak (cross-origin,
 * cy.origin) reçoit username/password puis le code TOTP calculé ici. Secrets uniquement via l'environnement
 * (CYPRESS_SIM_USERNAME, CYPRESS_SIM_USER_PASSWORD, CYPRESS_SIM_TOTP_SECRET_BASE32), jamais committés.
 * Keycloak refuse un code réutilisé dans la même fenêtre de 30 s : on attend la fenêtre suivante entre deux logins.
 */
let lastWindow = -1;
Cypress.Commands.add('loginKeycloak', () => {
  const username = Cypress.env('SIM_USERNAME') ?? 'dsi.admin';
  const password = Cypress.env('SIM_USER_PASSWORD');
  const secret = Cypress.env('SIM_TOTP_SECRET_BASE32');
  if (!password || !secret) throw new Error('CYPRESS_SIM_USER_PASSWORD and CYPRESS_SIM_TOTP_SECRET_BASE32 are required for live specs');
  cy.session(
    ['bff-code', username],
    () => {
      const entity = Cypress.env('ADM_ENTITY') ?? 'dss';
      cy.visit(`/api/auth/authorize?app=admin&entity=${entity}&returnTo=%2F`);
      cy.origin(
        Cypress.env('SIM_KC_URL') ?? 'http://localhost:8180',
        { args: { username, password } },
        ({ username, password }) => {
          cy.get('input[name=username]', { timeout: 20000 }).type(username);
          cy.get('input[name=password]').type(password, { log: false });
          cy.get('[name=login]').click();
        },
      );
      // fresh 30 s window, distinct from the previous login's (code reuse is refused)
      cy.then(() => {
        const win = Math.floor(Date.now() / 30000);
        const wait = win <= lastWindow ? 30000 - (Date.now() % 30000) + 500 : 0;
        return cy.wait(wait, { log: false }).then(() => import('otplib')).then(async ({ generate }) => {
          const code = await generate({ secret });
          lastWindow = Math.floor(Date.now() / 30000);
          return code;
        });
      }).then((code) => {
        cy.origin(
          Cypress.env('SIM_KC_URL') ?? 'http://localhost:8180',
          { args: { code } },
          ({ code }) => {
            cy.get('input[name=otp]', { timeout: 20000 }).type(code as string, { log: false });
            cy.get('[name=login]').click();
          },
        );
      });
      cy.location('origin', { timeout: 30000 }).should('eq', Cypress.config('baseUrl'));
      cy.get('[data-cy]', { timeout: 20000 }).should('exist');
    },
    { cacheAcrossSpecs: true },
  );
});

export {};
