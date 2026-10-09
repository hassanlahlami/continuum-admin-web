/**
 * Configuration d'exécution de la Plateforme Admin Système. Rien de sensible ici (§4, Vault).
 */
export const environment = {
  production: false,
  /** Émetteur OIDC (realm Keycloak), §4.5. :8180 = Keycloak de la simulation. */
  oidcIssuer: 'http://localhost:8180/realms/banque-demo',
  /** Préfixe de l'API d'administration, §4.3.3 (proxy de dev → backend :8080). */
  apiBaseUrl: '/api/admin',
};
