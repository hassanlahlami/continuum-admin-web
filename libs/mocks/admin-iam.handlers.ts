import { http, HttpResponse } from 'msw';
import type { AssignmentPage, OrgUnitNode, Position, RoleFeatureMatrix, UserAccount, UserPage } from '../api-clients/admin-iam';

/**
 * Mocks MSW de l'administration IAM (front-first, GUIDE §6) — annuaire des utilisateurs, fiches
 * (profils) et affectation de position, sans backend ni Keycloak. Données de démonstration anonymes (D37).
 * Deux utilisateurs « sentinelles » exercent les refus décidés par le serveur sur `POST /assignments` :
 *   …000000000409 → conflit SoD statique (409) ; …000000000422 → requête invalide / auto-octroi (422).
 * Le front n'enforce aucune règle : il affiche la décision renvoyée (D32).
 */
const SOD_USER = '00000000-0000-0000-0000-000000000409';
const INVALID_USER = '00000000-0000-0000-0000-000000000422';

const INSPECTION_UNIT = { id: 'b1111111-1111-1111-1111-111111111111', code: 'AG-A001', label: 'Agence A001' };
const AUDIT_UNIT = { id: '3f6c2a1e-8b7d-4c21-9a55-0e2f4b6d8c10', code: 'DIR_AUDIT', label: 'Inspection Générale' };

/** Annuaire de démonstration — un échantillon couvrant les statuts et sources de compte. */
const USERS: UserAccount[] = [
  {
    id: '00000000-0000-0000-0000-0000000000f1',
    username: 'ines.gendron',
    displayName: 'Inès Gendron',
    email: 'ines.gendron@banque-demo.test',
    source: 'AD',
    accountStatus: 'ACTIVE',
    mfaConfigured: true,
    lastLoginAt: '2026-02-03T08:12:00Z',
    activeSessions: 1,
    assignments: [
      {
        id: 'a55e0000-0000-0000-0000-0000000000a1',
        userId: '00000000-0000-0000-0000-0000000000f1',
        positionId: 'd1111111-1111-1111-1111-111111111111',
        positionLabel: 'Chef de mission',
        unit: AUDIT_UNIT,
        kind: 'HOLDER',
        validFrom: '2025-09-01',
        state: 'ACTIVE',
      },
    ],
  },
  {
    id: '00000000-0000-0000-0000-0000000000f2',
    username: 'omar.haddad',
    displayName: 'Omar Haddad',
    email: 'omar.haddad@banque-demo.test',
    source: 'AD',
    accountStatus: 'ACTIVE',
    mfaConfigured: true,
    lastLoginAt: '2026-02-02T16:40:00Z',
    activeSessions: 0,
    assignments: [
      {
        id: 'a55e0000-0000-0000-0000-0000000000a2',
        userId: '00000000-0000-0000-0000-0000000000f2',
        positionId: 'd2222222-2222-2222-2222-222222222222',
        positionLabel: 'Inspecteur',
        unit: INSPECTION_UNIT,
        kind: 'HOLDER',
        validFrom: '2025-10-15',
        state: 'ACTIVE',
      },
    ],
  },
  {
    id: '00000000-0000-0000-0000-0000000000f3',
    username: 'salma.benali',
    displayName: 'Salma Benali',
    email: 'salma.benali@banque-demo.test',
    source: 'LOCAL',
    accountStatus: 'LOCKED',
    mfaConfigured: false,
    lastLoginAt: '2026-01-20T09:05:00Z',
    activeSessions: 0,
    assignments: [
      {
        id: 'a55e0000-0000-0000-0000-0000000000a3',
        userId: '00000000-0000-0000-0000-0000000000f3',
        positionId: 'd3333333-3333-3333-3333-333333333333',
        positionLabel: 'Administrateur système',
        unit: AUDIT_UNIT,
        kind: 'HOLDER',
        validFrom: '2025-06-01',
        state: 'ACTIVE',
      },
    ],
  },
  {
    id: '00000000-0000-0000-0000-0000000000f4',
    username: 'youssef.alaoui',
    displayName: 'Youssef Alaoui',
    email: 'youssef.alaoui@banque-demo.test',
    source: 'AD',
    accountStatus: 'NO_ASSIGNMENT',
    mfaConfigured: true,
    lastLoginAt: '2026-02-01T11:30:00Z',
    activeSessions: 0,
    assignments: [],
  },
  {
    id: '00000000-0000-0000-0000-0000000000f5',
    username: 'audit.service',
    displayName: 'Compte de service Audit',
    email: 'svc.audit@banque-demo.test',
    source: 'LOCAL',
    accountStatus: 'DISABLED',
    mfaConfigured: false,
    activeSessions: 0,
    assignments: [],
  },
  // Sentinelles de refus d'affectation (sélectionnables dans le formulaire pour exercer les cas 409/422).
  {
    id: SOD_USER,
    username: 'rachid.benjelloun',
    displayName: 'Rachid Benjelloun',
    email: 'rachid.benjelloun@banque-demo.test',
    source: 'AD',
    accountStatus: 'ACTIVE',
    mfaConfigured: true,
    activeSessions: 0,
    assignments: [],
  },
  {
    id: INVALID_USER,
    username: 'fatima.zahra',
    displayName: 'Fatima Zahra',
    email: 'fatima.zahra@banque-demo.test',
    source: 'AD',
    accountStatus: 'ACTIVE',
    mfaConfigured: true,
    activeSessions: 0,
    assignments: [],
  },
];

/** Référentiel des positions (pack Banque, §2.1) — liste ADM-07 et sélecteur d'affectation (ADM-10). */
const POSITIONS: Position[] = [
  { id: 'd3333333-3333-3333-3333-333333333333', code: 'ADMIN_SYS', label: { fr: 'Administrateur système' }, rank: 10, scope: 'TENANT', active: true, fromPack: true, holdersCount: 1, pendingChange: false },
  { id: 'd1111111-1111-1111-1111-111111111111', code: 'CHEF_MISSION', label: { fr: 'Chef de mission' }, rank: 20, scope: 'UNIT_TREE', active: true, fromPack: true, unitTypeLabel: 'Direction', reportsToLabel: 'Administrateur système', holdersCount: 1, pendingChange: false },
  { id: 'd2222222-2222-2222-2222-222222222222', code: 'INSPECTEUR', label: { fr: 'Inspecteur' }, rank: 30, scope: 'UNIT', active: true, fromPack: true, unitTypeLabel: 'Agence', reportsToLabel: 'Chef de mission', holdersCount: 1, pendingChange: true },
  { id: 'd4444444-4444-4444-4444-444444444444', code: 'AUDITEUR_JUNIOR', label: { fr: 'Auditeur junior' }, rank: 40, scope: 'UNIT', active: false, fromPack: false, unitTypeLabel: 'Agence', reportsToLabel: 'Inspecteur', holdersCount: 0, pendingChange: false },
];

/** Arbre des unités (pour le sélecteur d'unité). */
const ORG_UNITS: OrgUnitNode[] = [
  {
    id: AUDIT_UNIT.id,
    code: AUDIT_UNIT.code,
    label: AUDIT_UNIT.label,
    typeLabel: 'Direction',
    children: [{ id: INSPECTION_UNIT.id, code: INSPECTION_UNIT.code, label: INSPECTION_UNIT.label, typeLabel: 'Agence' }],
  },
];

/** Matrice rôles × fonctionnalités (ADM-09) avec une fonctionnalité sensible et un conflit SoD. */
const ROLE_MATRIX: RoleFeatureMatrix = {
  version: 1,
  roles: [
    { id: 'a1111111-1111-1111-1111-111111111111', code: 'ADMIN', label: { fr: 'Administrateur' }, kind: 'ORGANISATIONAL', fromPack: true },
    { id: 'a2222222-2222-2222-2222-222222222222', code: 'AUDITOR', label: { fr: 'Auditeur' }, kind: 'ORGANISATIONAL', fromPack: true },
  ],
  features: [
    { code: 'admin.user.read', module: 'Utilisateurs', label: 'Consulter les utilisateurs' },
    { code: 'admin.role.manage', module: 'Rôles', label: 'Gérer les rôles', sensitive: true },
    { code: 'report.approve', module: 'Rapports', label: 'Approuver un rapport' },
  ],
  grants: [
    { roleId: 'a1111111-1111-1111-1111-111111111111', featureCode: 'admin.user.read' },
    { roleId: 'a1111111-1111-1111-1111-111111111111', featureCode: 'admin.role.manage' },
    { roleId: 'a2222222-2222-2222-2222-222222222222', featureCode: 'report.approve' },
  ],
  sodWarnings: [{ roleId: 'a1111111-1111-1111-1111-111111111111', ruleId: 'a9999999-9999-9999-9999-999999999999', message: 'Gérer les rôles et consulter les utilisateurs sont incompatibles' }],
};

export const adminIamHandlers = [
  http.get('*/api/admin/role-feature-matrix', () => HttpResponse.json(ROLE_MATRIX)),

  // Référentiel des positions : actives par défaut, désactivées sur `includeInactive=true` (filtre serveur).
  http.get('*/api/admin/positions', ({ request }) => {
    const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';
    return HttpResponse.json(POSITIONS.filter((p) => includeInactive || p.active));
  }),

  // Arbre des unités (sélecteur d'unité).
  http.get('*/api/admin/org/units', () => HttpResponse.json(ORG_UNITS)),

  // Affectations existantes (aperçu récent sur la page d'affectation).
  http.get('*/api/admin/assignments', () => {
    const items = USERS.flatMap((u) =>
      (u.assignments ?? []).map((a) => ({ ...a, user: { id: u.id, displayName: u.displayName } })),
    );
    const page: AssignmentPage = { page: 0, size: 20, totalItems: items.length, totalPages: 1, items };
    return HttpResponse.json(page);
  }),

  // Annuaire : recherche libre + filtres statut / source, servis côté « serveur ».
  http.get('*/api/admin/users', ({ request }) => {
    const url = new URL(request.url);
    const q = url.searchParams.get('q')?.toLowerCase();
    const status = url.searchParams.get('accountStatus');
    const source = url.searchParams.get('source');
    const items = USERS.filter(
      (u) =>
        (!q || `${u.displayName} ${u.username} ${u.email ?? ''}`.toLowerCase().includes(q)) &&
        (!status || u.accountStatus === status) &&
        (!source || u.source === source),
    );
    const page: UserPage = { page: 0, size: 20, totalItems: items.length, totalPages: 1, items };
    return HttpResponse.json(page);
  }),

  // Fiche (profil) d'un utilisateur.
  http.get('*/api/admin/users/:userId', ({ params }) => {
    const user = USERS.find((u) => u.id === String(params['userId'])) ?? USERS[0];
    return HttpResponse.json(user);
  }),

  // Création d'un compte local. Identifiant « existant » → 409 (démo de l'unicité décidée par le serveur).
  http.post('*/api/admin/users', async ({ request }) => {
    const body = (await request.json().catch(() => null)) as Partial<Record<'username' | 'firstName' | 'lastName' | 'email', string>> | null;
    const username = body?.username ?? '';
    if (username.toLowerCase() === 'existant' || USERS.some((u) => u.username === username)) {
      return HttpResponse.json(
        { title: 'Conflit', detail: `L'identifiant « ${username} » est déjà utilisé.` },
        { status: 409, headers: { 'content-type': 'application/problem+json' } },
      );
    }
    const created: UserAccount = {
      id: 'c0000000-0000-0000-0000-000000000001',
      username,
      displayName: `${body?.firstName ?? ''} ${body?.lastName ?? ''}`.trim() || username,
      email: body?.email,
      source: 'LOCAL',
      accountStatus: 'NO_ASSIGNMENT',
      mfaConfigured: false,
      activeSessions: 0,
      assignments: [],
    };
    USERS.push(created);
    return HttpResponse.json(created, { status: 201 });
  }),

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
