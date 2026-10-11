import { http, HttpResponse } from 'msw';

/**
 * Mocks MSW de l'administration IAM (front-first, GUIDE §6) — sert `POST /assignments` sans backend.
 * Deux utilisateurs « sentinelles » exercent les refus décidés par le serveur (§2.1.8) côté e2e :
 *   …000000000409 → conflit SoD statique (409) ; …000000000422 → requête invalide / auto-octroi (422).
 * Le front n'enforce aucune règle : il affiche la décision renvoyée (D32).
 */
const SOD_USER = '00000000-0000-0000-0000-000000000409';
const INVALID_USER = '00000000-0000-0000-0000-000000000422';

export const adminIamHandlers = [
  http.post('*/api/admin/assignments', async ({ request }) => {
    const body = (await request.json().catch(() => null)) as { userId?: string } | null;
    const userId = body?.userId ?? '';
    if (userId === SOD_USER) {
      return HttpResponse.json(
        { title: 'Conflit SoD', detail: 'Affectation refusée : conflit SoD statique (§2.1.8).' },
        { status: 409, headers: { 'content-type': 'application/problem+json' } },
      );
    }
    if (userId === INVALID_USER) {
      return HttpResponse.json(
        { title: 'Requête invalide', detail: "Auto-octroi interdit : l'auteur ne peut pas être le bénéficiaire (§2.1.8)." },
        { status: 422, headers: { 'content-type': 'application/problem+json' } },
      );
    }
    return HttpResponse.json(
      { id: 'a55e0000-0000-0000-0000-000000000001', state: 'ACTIVE' },
      { status: 201 },
    );
  }),
];
