/**
 * AUTH-01 — Step-up admin (ADR 0014 avenant b, auth v0.2.0) : un 401 `step-up-required` sur `/api/admin/**`
 * déclenche la navigation vers `/api/auth/step-up?app=admin&acr=<requiredAcr>&returnTo=<route>`.
 */
describe('AUTH-01 — step-up-required', () => {
  beforeEach(() => cy.viewport(1280, 800));

  it('navigue vers le step-up avec app=admin, acr exigé et returnTo', () => {
    cy.intercept('GET', '**/api/auth/step-up*', (req) => {
      req.reply({ statusCode: 200, headers: { 'content-type': 'text/html' }, body: '<html><body data-cy="stepup-stub">step-up</body></html>' });
    }).as('stepUp');
    cy.visit('/entities', { onBeforeLoad: (w) => w.localStorage.setItem('ct-mock-entities', 'step-up') });
    cy.wait('@stepUp').its('request.url').then((u) => {
      const url = new URL(u);
      expect(url.pathname).to.eq('/api/auth/step-up');
      expect(url.searchParams.get('app')).to.eq('admin');
      expect(url.searchParams.get('acr')).to.eq('2');
      expect(url.searchParams.get('returnTo')).to.eq('/entities');
    });
  });
});
