import { http, HttpResponse } from 'msw';
import type { AuditEventPage } from '../api-clients/operations';

/**
 * Mocks MSW du module « operations » (Admin Système, front-first D32) — piste d'audit des opérations.
 * Données de démonstration anonymes (D37) ; filtrage léger par `eventType`/`objectType` pour que les
 * filtres de la page soient visibles sans backend.
 */
const EVENTS: NonNullable<AuditEventPage['items']> = [
  {
    id: '00000000-0000-0000-0000-0000000000a1',
    at: '2026-02-03T09:12:04Z',
    actor: { id: '00000000-0000-0000-0000-0000000000f1', displayName: 'Inès Gendron', positionLabel: 'Chef de mission' },
    eventType: 'FINDING_VALIDATED',
    objectType: 'FINDING',
    objectId: 'FND-2026-INSP-014-001',
    before: { status: 'OUVERT', version: 1 },
    after: { status: 'VALIDATED', version: 2 },
    chainHash: '7a3f9c1e8b2d4a6f',
  },
  {
    id: '00000000-0000-0000-0000-0000000000a2',
    at: '2026-02-03T08:47:51Z',
    actor: { id: '00000000-0000-0000-0000-0000000000f2', displayName: 'Omar Haddad', positionLabel: 'Inspecteur' },
    eventType: 'CCM_EXCEPTION_TRIAGED',
    objectType: 'CCM_EXCEPTION',
    objectId: 'EXC-2026-0042',
    before: { status: 'NEW', assignee: null },
    after: { status: 'RETAINED', assignee: 'Inès Gendron' },
    chainHash: '1c5e2a7d9f0b3e4c',
  },
  {
    id: '00000000-0000-0000-0000-0000000000a3',
    at: '2026-02-02T16:30:12Z',
    actor: { id: '00000000-0000-0000-0000-0000000000f3', displayName: 'Salma Benali', positionLabel: 'Administrateur système' },
    eventType: 'ASSIGNMENT_CREATED',
    objectType: 'ASSIGNMENT',
    objectId: 'ASG-2026-0117',
    before: null,
    after: { positionLabel: 'Chef de mission', unit: 'Inspection A001', kind: 'HOLDER' },
    chainHash: 'b8d4f6a2c0e1d3f5',
  },
  {
    id: '00000000-0000-0000-0000-0000000000a4',
    at: '2026-02-02T11:05:38Z',
    actor: { id: '00000000-0000-0000-0000-0000000000f1', displayName: 'Inès Gendron', positionLabel: 'Chef de mission' },
    eventType: 'CONTROL_SETTINGS_UPDATED',
    objectType: 'CCM_CONTROL',
    objectId: 'SOD-VIREMENTS',
    before: { threshold: '100000.00', active: false },
    after: { threshold: '50000.00', active: true },
    chainHash: 'e2a9c4b7d1f806a3',
  },
];

export const operationsHandlers = [
  http.get('*/api/admin/audit-trail/events', ({ request }) => {
    const url = new URL(request.url);
    const eventType = url.searchParams.get('eventType')?.toUpperCase();
    const objectType = url.searchParams.get('objectType')?.toUpperCase();
    const items = EVENTS.filter(
      (e) =>
        (!eventType || (e.eventType ?? '').toUpperCase().includes(eventType)) &&
        (!objectType || (e.objectType ?? '').toUpperCase().includes(objectType)),
    );
    const page: AuditEventPage = { page: 0, size: 20, totalItems: items.length, totalPages: 1, items };
    return HttpResponse.json(page);
  }),
];
