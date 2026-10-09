import { AuthConfig } from 'angular-oauth2-oidc';
import { environment } from '../../environments/environment';

/**
 * Configuration OIDC de l'Admin Système (plan §4.5) : client `continuum-admin`, Authorization Code
 * + PKCE vers Keycloak. Audience `continuum-admin` et niveau d'authentification élevé exigés par le
 * backend (§4.3.3) ; l'`issuer` vient de l'`environment`.
 */
export const authConfig: AuthConfig = {
  issuer: environment.oidcIssuer,
  clientId: 'continuum-admin',
  responseType: 'code',
  redirectUri: typeof window !== 'undefined' ? window.location.origin + '/' : '/',
  scope: 'openid profile email',
  requireHttps: false, // dev/simulation uniquement
  showDebugInformation: false,
};
