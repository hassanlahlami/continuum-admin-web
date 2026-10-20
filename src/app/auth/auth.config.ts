import { AuthConfig } from 'angular-oauth2-oidc';

/**
 * Configuration OIDC de l'Admin Système (plan §4.5) : client `continuum-admin`, Authorization Code
 * + PKCE vers Keycloak. Audience `continuum-admin` et niveau d'authentification élevé exigés par le
 * backend (§4.3.3). L'`issuer` est une **configuration d'exécution par installation** (runtime config
 * `config.json`, cf. main.ts) ; {@code requireHttps} est déduit de l'issuer (HTTPS ⇒ exigé).
 */
export function buildAuthConfig(issuer: string): AuthConfig {
  return {
    issuer,
    clientId: 'continuum-admin',
    responseType: 'code',
    redirectUri: typeof window !== 'undefined' ? window.location.origin + '/' : '/',
    scope: 'openid profile email',
    requireHttps: issuer.startsWith('https'),
    showDebugInformation: false,
  };
}
