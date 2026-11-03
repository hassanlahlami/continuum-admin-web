# continuum-admin-web

Front de la **Plateforme Admin Système** (Angular 19, Material). Développement **front-first piloté par
contrat** (D32) : le client TypeScript est **généré** depuis les contrats OpenAPI, jamais écrit à la
main. Coquille « cockpit » (sidenav + toolbar) habillée par les tokens `--ct-*`, à parité avec
`continuum-app-web`.

## Client API généré

Le client est généré depuis la spec **bundlée** (redocly) et **n'est pas commité** (`libs/api-clients/*`
git-ignoré, D32) :

```bash
npm install
npm run generate:admin-iam    # libs/api-clients/admin-iam (typescript-angular)
npm run compile:templates     # ngc : type-check strict des templates
```

Source du contrat : `../Instructions/contracts/openapi/admin/…` ; spec bundlée consommée :
`../continuum-backend/src/main/openapi/admin-iam.bundled.yaml`.

## Lancer & tester

```bash
npm start            # ng serve --port 4201 (mocks MSW)
npm run serve:live   # configuration « live » (vrai backend + OIDC)
npm run e2e          # Cypress (sert le mock puis lance e2e/)
```

Les tests e2e utilisent des sélecteurs `data-cy` uniquement (D36) ; suite actuelle : `ADM-07` (liste des positions), `ADM-10`
(affecter une position — décision serveur, SoD, thème).

## Conventions

Uniquement des tokens `--ct-*` (aucune valeur visuelle en dur, §1.6) ; mode sombre + bascule de thème à
parité avec `app-web`. `ui-kit`/`theme.scss` sont **dupliqués** avec `app-web` (non générés, REPOS.md) :
reporter toute évolution dans les deux. Prérequis : Node ≥ 20.

## Références

Contrats : `../Instructions/contracts/`. Plan : `../Instructions/plan-plateforme-audit-interne-erp.md`
(§1.2/§4.4.2). Suivi : `../Instructions/docs/suivi/`.

## D41 auth migration plan (BFF cookie session)
Admin stays `login.mode=redirect`. Swap, once the backend BFF lands (angular-oauth2-oidc stays until then):
1. `auth.interceptor.ts`: drop Bearer; `withCredentials` + `X-XSRF-TOKEN` (from `XSRF-TOKEN` cookie) on unsafe `/api/` requests; on 403 `csrf-invalid` re-read cookie, replay once.
2. Bootstrap: `GET /api/auth/session` (sets CSRF cookie) replaces OAuthService init; unauthenticated -> navigate to `/api/auth/authorize?returnTo=`.
3. 401 `reason: step-up-required` -> navigate to `/api/auth/step-up?acr=<requiredAcr>&returnTo=<current>` (never via REST); `session-expired`/`unauthenticated` -> authorize.
4. Logout: `POST /api/auth/logout`. Then remove angular-oauth2-oidc.
Client: `npm run generate:auth` (libs/api-clients/auth); mocks: `libs/mocks/auth.handlers.ts`.
