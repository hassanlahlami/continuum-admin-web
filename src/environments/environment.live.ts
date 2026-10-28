/**
 * Configuration d'exécution « live » de la Plateforme Admin Système : vrai backend + connexion OIDC
 * (pas de mocks). Sélectionnée par la configuration `live` (fileReplacements). Rien de sensible ici (§4, Vault).
 */
export const environment = {
  production: false,
  /** false = vrai backend + login OIDC exigé (§4.5). */
  useMocks: false,
  /** Émetteur OIDC (realm Keycloak), §4.5. :8180 = Keycloak de la simulation. */
  oidcIssuer: 'http://localhost:8180/realms/banque-demo',
  /** Préfixe de l'API d'administration, §4.3.3 (proxy de dev → backend :8082). */
  apiBaseUrl: '/api/admin',
};
