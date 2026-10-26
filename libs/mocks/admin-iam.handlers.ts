import { http, HttpResponse } from 'msw';
import type { ChangeRequest, Entity, EntityInput, ListSodConflicts200ResponseInner, SodRule, AdminOverview, AssignmentPage, OrgUnitNode, Position, PositionInput, RoleFeatureMatrix, UserAccount, UserPage } from '../api-clients/admin-iam';

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
  availableActions: [{ code: 'update-matrix', label: 'Modifier la matrice', style: 'primary' }],
};

/** Rôles portés par chaque position (état mutable des mocks, ADM-08), initialisé depuis le pack. */
const POSITION_ROLE_IDS = new Map<string, string[]>([
  ['d3333333-3333-3333-3333-333333333333', ['a1111111-1111-1111-1111-111111111111']],
  ['d1111111-1111-1111-1111-111111111111', ['a2222222-2222-2222-2222-222222222222']],
  ['d2222222-2222-2222-2222-222222222222', ['a2222222-2222-2222-2222-222222222222']],
]);

/** Position occupée par l'administrateur courant : toute modification est refusée (403). */
const SELF_OCCUPIED_POSITION = 'd3333333-3333-3333-3333-333333333333';

const SENSITIVE_FEATURES = new Set(ROLE_MATRIX.features.filter((f) => f.sensitive).map((f) => f.code));

/** Position « détaillée » : rôles portés et fonctionnalités résultantes (union des grants des rôles). */
const positionDetail = (p: Position): Position => {
  const roleIds = POSITION_ROLE_IDS.get(p.id) ?? [];
  return {
    ...p,
    roles: ROLE_MATRIX.roles.filter((r) => roleIds.includes(r.id)),
    resultingFeatures: [...new Set(ROLE_MATRIX.grants.filter((g) => g.roleId !== undefined && roleIds.includes(g.roleId)).flatMap((g) => (g.featureCode ? [g.featureCode] : [])))],
  };
};

/** Clé localStorage activant la matrice en lecture seule (surcharge utilisée par les specs Cypress). */
export const READONLY_OVERRIDE_KEY = 'ct-mock-roles-readonly';

/** Clé localStorage de surcharge e2e de l'accueil : `forbidden` (403), `error` (500), `slow` (réponse différée). */
export const OVERVIEW_OVERRIDE_KEY = 'ct-mock-overview';

const OVERVIEW: AdminOverview = {
  health: 'DEGRADED',
  pendingChangeRequests: 3,
  pendingPublications: 1,
  openAlerts: 5,
  usersWithoutAssignment: 7,
  staticSodConflicts: 0,
  lastDirectorySyncAt: '2026-02-03T06:00:00Z',
  licenseExpiresOn: '2027-01-31',
  connectorsDown: 2,
};

/** Clé localStorage de surcharge e2e des règles SoD (ADM-11) : `forbidden` (403 partout), `conflict` (409 sur modification), `error` (500 en lecture). */
export const SOD_OVERRIDE_KEY = 'ct-mock-sod';

/** Actions d'une règle locale (edit, delete) ; une règle livrée par le pack n'en porte aucune. */
const SOD_LOCAL_ACTIONS = [
  { code: 'edit', label: 'Modifier' },
  { code: 'delete', label: 'Supprimer', style: 'danger' as const },
];

/** Règles SoD de démonstration : une règle du pack (non modifiable) et une règle locale (modifiable). */
const SOD_RULES: SodRule[] = [
  { id: 'e1000000-0000-0000-0000-000000000001', version: 1, featureA: 'finding.write', featureB: 'finding.validate', type: 'STATIC', severity: 'BLOCK', description: 'Auteur et validateur d’un constat doivent être distincts', fromPack: true, availableActions: [] },
  { id: 'e1000000-0000-0000-0000-000000000002', version: 1, featureA: 'report.approve', featureB: 'report.publish', type: 'DYNAMIC', severity: 'WARN', description: 'Pas sur le même rapport', fromPack: false, availableActions: SOD_LOCAL_ACTIONS },
];
const SOD_CONFLICTS: ListSodConflicts200ResponseInner[] = [
  { user: { id: '00000000-0000-0000-0000-0000000000f1', displayName: 'Inès Gendron', positionLabel: 'Chef de mission', unitLabel: 'Inspection Générale' }, rule: SOD_RULES[0], viaAssignments: ['a55e0000-0000-0000-0000-0000000000a1', 'a55e0000-0000-0000-0000-0000000000a2'] },
];
const sodMode = () => globalThis.localStorage?.getItem(SOD_OVERRIDE_KEY);
const canSod = (rule: SodRule, code: string) => !!rule.availableActions?.some((a) => a.code === code);

/** Demandes de double validation de démonstration (ADM-14) : la 2e est celle de l'utilisateur courant (aucune action). */
const CR_ACTIONS = [{ code: 'approve', label: 'Approuver' }, { code: 'reject', label: 'Rejeter', requiresComment: true }];
const CHANGE_REQUESTS: ChangeRequest[] = [
  { id: 'c0000000-0000-0000-0000-000000000001', kind: 'ASSIGNMENT', summary: 'Affecter insp2.demo comme Chef de département Inspection (intérim)', state: 'PENDING', requestedBy: { id: '00000000-0000-0000-0000-0000000000f1', displayName: 'Inès Gendron' }, requestedAt: '2026-02-03T09:00:00Z', beneficiary: { id: '00000000-0000-0000-0000-0000000000f2', displayName: 'Inspecteur Deux' }, sensitiveFeatures: ['finding.validate', 'report.publish'], availableActions: CR_ACTIONS },
  { id: 'c0000000-0000-0000-0000-000000000002', kind: 'SOD_RULE', summary: 'Supprimer la règle report.approve / report.publish', state: 'PENDING', requestedBy: { id: '00000000-0000-0000-0000-0000000000f3', displayName: 'Admin Demo' }, requestedAt: '2026-02-03T10:30:00Z', sensitiveFeatures: [], availableActions: [] },
  { id: 'c0000000-0000-0000-0000-000000000003', kind: 'ROLE_FEATURES', summary: 'Ajouter report.publish au rôle Inspecteur', state: 'PENDING', requestedBy: { id: '00000000-0000-0000-0000-0000000000f1', displayName: 'Inès Gendron' }, requestedAt: '2026-02-02T15:00:00Z', sensitiveFeatures: ['report.publish'], availableActions: CR_ACTIONS },
];
const crMode = () => globalThis.localStorage?.getItem('ct-mock-change-requests');

/** Entités (tenants) de démonstration (ADM-02) ; surcharge localStorage `ct-mock-entities` : forbidden, error, invalid. */
const ENTITIES: Entity[] = [
  { id: 'e2000000-0000-0000-0000-000000000001', code: 'BANQUE-DEMO', label: 'Banque Démo — Maison mère', status: 'ACTIVE', keycloakRealm: 'banque-demo', dataIsolation: 'SCHEMA', packCode: 'PACK-BANQUE', enabledModules: ['AUDIT', 'CCM', 'REPORTING'], locales: ['fr', 'ar'], defaultLocale: 'fr', usersCount: 42 },
  { id: 'e2000000-0000-0000-0000-000000000002', code: 'BANQUE-DEMO-FILIALE-01', label: 'Banque Démo — Filiale Leasing', status: 'SUSPENDED', keycloakRealm: 'banque-demo-filiale-01', dataIsolation: 'PDB', packCode: 'PACK-BANQUE', enabledModules: ['AUDIT'], locales: ['fr'], defaultLocale: 'fr', usersCount: 7 },
];
const entityMode = () => globalThis.localStorage?.getItem('ct-mock-entities');

export const adminIamHandlers = [
  // Entités (ADM-02) : lecture et création (Job 202 : schéma/PDB, realm, pack ; le serveur valide, 422 si code vide ou en double).
  http.get('*/api/admin/entities', () => {
    if (entityMode() === 'forbidden') return new HttpResponse(null, { status: 403 });
    if (entityMode() === 'error') return new HttpResponse(null, { status: 500 });
    return HttpResponse.json(ENTITIES);
  }),
  http.post('*/api/admin/entities', async ({ request }) => {
    if (entityMode() === 'forbidden') return new HttpResponse(null, { status: 403 });
    const body = (await request.json()) as EntityInput;
    if (entityMode() === 'invalid' || !body.code?.trim() || ENTITIES.some((e) => e.code === body.code)) return HttpResponse.json({ title: 'Invalid entity' }, { status: 422 });
    ENTITIES.push({ ...body, id: 'e2000000-0000-0000-0000-' + String(ENTITIES.length + 1).padStart(12, '0'), status: 'PROVISIONING', keycloakRealm: body.code.toLowerCase(), dataIsolation: 'SCHEMA', usersCount: 0 });
    return HttpResponse.json({ id: 'f0000000-0000-0000-0000-000000000001', type: 'ENTITY_PROVISIONING', status: 'QUEUED', progress: 0 }, { status: 202 });
  }),
  // Demandes en attente de validation (ADM-14) ; surcharge localStorage `ct-mock-change-requests` : forbidden, error, conflict.
  http.get('*/api/admin/change-requests', ({ request }) => {
    if (crMode() === 'forbidden') return new HttpResponse(null, { status: 403 });
    if (crMode() === 'error') return new HttpResponse(null, { status: 500 });
    const state = new URL(request.url).searchParams.get('state') ?? 'PENDING';
    return HttpResponse.json(CHANGE_REQUESTS.filter((c) => c.state === state));
  }),
  http.post('*/api/admin/change-requests/:id/actions/:code', async ({ request, params }) => {
    if (crMode() === 'forbidden') return new HttpResponse(null, { status: 403 });
    if (crMode() === 'conflict') return new HttpResponse(null, { status: 409 });
    const body = (await request.json()) as { comment?: string };
    const cr = CHANGE_REQUESTS.find((c) => c.id === params['id']);
    if (!cr) return new HttpResponse(null, { status: 404 });
    if (!cr.availableActions?.some((a) => a.code === params['code'])) return new HttpResponse(null, { status: 403 });
    if (params['code'] === 'reject' && !body.comment?.trim()) return HttpResponse.json({ title: 'Reason required' }, { status: 422 });
    cr.state = params['code'] === 'approve' ? 'APPROVED' : 'REJECTED';
    cr.availableActions = [];
    return HttpResponse.json(cr);
  }),
  // Règles de séparation des tâches (ADM-11) : lecture, création, modification (409 si surcharge `conflict`), suppression (double validation).
  http.get('*/api/admin/sod-rules', () => {
    if (sodMode() === 'forbidden') return new HttpResponse(null, { status: 403 });
    if (sodMode() === 'error') return new HttpResponse(null, { status: 500 });
    return HttpResponse.json(SOD_RULES);
  }),
  http.post('*/api/admin/sod-rules', async ({ request }) => {
    if (sodMode() === 'forbidden') return new HttpResponse(null, { status: 403 });
    const body = (await request.json()) as SodRule;
    if (!body.featureA || !body.featureB || body.featureA === body.featureB) return HttpResponse.json({ title: 'Invalid rule' }, { status: 422 });
    const rule: SodRule = { ...body, id: 'e1000000-0000-0000-0000-' + String(SOD_RULES.length + 1).padStart(12, '0'), version: 1, fromPack: false, availableActions: SOD_LOCAL_ACTIONS };
    SOD_RULES.push(rule);
    return HttpResponse.json(rule, { status: 201 });
  }),
  http.put('*/api/admin/sod-rules/:ruleId', async ({ request, params }) => {
    if (sodMode() === 'forbidden') return new HttpResponse(null, { status: 403 });
    if (sodMode() === 'conflict') return new HttpResponse(null, { status: 409 });
    const body = (await request.json()) as SodRule;
    const i = SOD_RULES.findIndex((r) => r.id === params['ruleId']);
    if (i < 0) return new HttpResponse(null, { status: 404 });
    if (!canSod(SOD_RULES[i], 'edit')) return new HttpResponse(null, { status: 403 });
    SOD_RULES[i] = { ...body, id: SOD_RULES[i].id, version: (SOD_RULES[i].version ?? 1) + 1, fromPack: SOD_RULES[i].fromPack, availableActions: SOD_RULES[i].availableActions };
    return HttpResponse.json(SOD_RULES[i]);
  }),
  http.delete('*/api/admin/sod-rules/:ruleId', ({ params }) => {
    if (sodMode() === 'forbidden') return new HttpResponse(null, { status: 403 });
    const rule = SOD_RULES.find((r) => r.id === params['ruleId']);
    if (!rule) return new HttpResponse(null, { status: 404 });
    if (!canSod(rule, 'delete')) return new HttpResponse(null, { status: 403 });
    return HttpResponse.json({ state: 'PENDING_APPROVAL', changeRequestId: 'c0000000-0000-0000-0000-000000000002' });
  }),
  http.get('*/api/admin/sod-conflicts', () => sodMode() === 'forbidden' ? new HttpResponse(null, { status: 403 }) : HttpResponse.json(SOD_CONFLICTS)),


  // Accueil Admin Système (ADM-01) ; la clé `OVERVIEW_OVERRIDE_KEY` du localStorage simule refus, panne ou lenteur.
  http.get('*/api/admin/overview', async () => {
    const mode = globalThis.localStorage?.getItem(OVERVIEW_OVERRIDE_KEY);
    if (mode === 'forbidden') return new HttpResponse(null, { status: 403 });
    if (mode === 'error') return new HttpResponse(null, { status: 500 });
    if (mode === 'slow') await new Promise((r) => setTimeout(r, 1500));
    return HttpResponse.json(OVERVIEW);
  }),

  // Surcharge e2e : la clé `READONLY_OVERRIDE_KEY` du localStorage retire `availableActions` (profil sans droit de modification).
  http.get('*/api/admin/role-feature-matrix', () =>
    HttpResponse.json(globalThis.localStorage?.getItem(READONLY_OVERRIDE_KEY) === 'true' ? { ...ROLE_MATRIX, availableActions: [] } : ROLE_MATRIX)),

  // Modification différentielle (ADM-09) : version périmée → 409 ; retirer à l'administrateur courant sa gestion
  // des rôles → 403 ; toucher une fonctionnalité sensible → double validation (rien n'est appliqué).
  http.put('*/api/admin/role-feature-matrix', async ({ request }) => {
    const body = (await request.json()) as { version: number; changes: { roleId: string; featureCode: string; granted: boolean }[] };
    if (!ROLE_MATRIX.availableActions?.some((a) => a.code === 'update-matrix')) return new HttpResponse(null, { status: 403 });
    // Sentinelle de concurrence : retirer « report.approve » à l'auditeur simule une matrice modifiée entre-temps.
    if (body.version !== ROLE_MATRIX.version || body.changes.some((c) => c.roleId === ROLE_MATRIX.roles[1].id && c.featureCode === 'report.approve' && !c.granted)) return new HttpResponse(null, { status: 409 });
    if (body.changes.some((c) => c.roleId === ROLE_MATRIX.roles[0].id && c.featureCode === 'admin.role.manage' && !c.granted)) {
      return new HttpResponse(null, { status: 403 });
    }
    if (body.changes.some((c) => SENSITIVE_FEATURES.has(c.featureCode))) {
      return HttpResponse.json({ state: 'PENDING_APPROVAL', changeRequestId: 'c0000000-0000-0000-0000-000000000001' });
    }
    for (const c of body.changes) {
      const i = ROLE_MATRIX.grants.findIndex((g) => g.roleId === c.roleId && g.featureCode === c.featureCode);
      if (c.granted && i < 0) ROLE_MATRIX.grants.push({ roleId: c.roleId, featureCode: c.featureCode });
      if (!c.granted && i >= 0) ROLE_MATRIX.grants.splice(i, 1);
    }
    ROLE_MATRIX.version += 1;
    return HttpResponse.json({ state: 'APPLIED' });
  }),

  // Catalogue des fonctionnalités (lecture seule), groupé par module côté contrat.
  http.get('*/api/admin/features', () => HttpResponse.json(ROLE_MATRIX.features)),

  // Référentiel des positions : actives par défaut, désactivées sur `includeInactive=true` (filtre serveur).
  http.get('*/api/admin/positions', ({ request }) => {
    const includeInactive = new URL(request.url).searchParams.get('includeInactive') === 'true';
    return HttpResponse.json(POSITIONS.filter((p) => includeInactive || p.active));
  }),

  // Détail d'une position (ADM-08) : rôles et fonctionnalités résultantes calculés depuis la matrice.
  http.get('*/api/admin/positions/:positionId', ({ params }) => {
    const p = POSITIONS.find((x) => x.id === params.positionId);
    return p ? HttpResponse.json(positionDetail(p)) : new HttpResponse(null, { status: 404 });
  }),

  // Modification (ADM-08) : un rôle qui porte une fonctionnalité sensible passe en double validation.
  // La position occupée par l'administrateur courant refuse la modification (403, §2.1.8).
  http.put('*/api/admin/positions/:positionId', async ({ params, request }) => {
    const p = POSITIONS.find((x) => x.id === params.positionId);
    if (!p) return new HttpResponse(null, { status: 404 });
    if (p.id === SELF_OCCUPIED_POSITION) return new HttpResponse(null, { status: 403 });
    const body = (await request.json()) as PositionInput;
    const roleIds = body.roleIds ?? [];
    POSITION_ROLE_IDS.set(p.id, roleIds);
    p.label = body.label;
    p.rank = body.rank;
    p.scope = body.scope;
    p.maxHoldersPerUnit = body.maxHoldersPerUnit;
    p.pendingChange = positionDetail(p).resultingFeatures?.some((code) => SENSITIVE_FEATURES.has(code)) ?? false;
    return HttpResponse.json(positionDetail(p));
  }),

  // Désactivation / réactivation (ADM-08).
  http.post('*/api/admin/positions/:positionId/actions/:actionCode', ({ params }) => {
    const p = POSITIONS.find((x) => x.id === params.positionId);
    if (!p) return new HttpResponse(null, { status: 404 });
    if (params.actionCode !== 'deactivate' && params.actionCode !== 'reactivate') return new HttpResponse(null, { status: 404 });
    p.active = params.actionCode === 'reactivate';
    return HttpResponse.json(positionDetail(p));
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

  // Simulateur « X peut-il faire F ? » (ADM-12). Sans `featureCode` : liste des fonctionnalités accordées.
  // L'utilisateur sentinelle SoD est refusé à cause d'un conflit ; les autres reçoivent la décision démo.
  http.post('*/api/admin/authz-simulations', async ({ request }) => {
    const body = (await request.json().catch(() => null)) as { userId?: string; featureCode?: string } | null;
    const userId = body?.userId ?? '';
    const user = USERS.find((u) => u.id === userId);
    if (!user) {
      return HttpResponse.json({ title: 'Introuvable', detail: 'Utilisateur inconnu.' }, { status: 404, headers: { 'content-type': 'application/problem+json' } });
    }
    if (userId === SOD_USER) {
      return HttpResponse.json({
        allowed: false,
        explanation: [
          { step: 'Affectation « Chef de département Inspection » (titulaire)', result: 'GRANTS' },
          { step: 'Règle de séparation des tâches « création + validation »', result: 'BLOCKED_BY_SOD' },
        ],
      });
    }
    const explanation = [
      { step: 'Affectation « Inspecteur » (titulaire, depuis 2026-01-01)', result: 'GRANTS' as const },
      { step: 'Rôle « Auditeur » : fonctionnalité couverte sur l’unité', result: 'GRANTS' as const },
    ];
    if (!body?.featureCode) {
      return HttpResponse.json({ allowed: true, features: [{ code: 'report.approve', scopes: ['UNIT'] }, { code: 'admin.user.read', scopes: ['TENANT'] }], explanation: [] });
    }
    const allowed = body.featureCode === 'report.approve';
    return HttpResponse.json({
      allowed,
      explanation: allowed ? explanation : [{ step: 'Aucun rôle de l’affectation n’accorde cette fonctionnalité', result: 'DOES_NOT_COVER' as const }],
    });
  }),

  // « Qui peut faire F sur R ? » — personnes habilitées et position qui le permet.
  http.post('*/api/admin/authz-simulations/who-can', async ({ request }) => {
    const body = (await request.json().catch(() => null)) as { featureCode?: string } | null;
    if (body?.featureCode !== 'report.approve') {
      return HttpResponse.json([]);
    }
    return HttpResponse.json([
      { user: { id: USERS[0].id, displayName: USERS[0].displayName }, via: 'Position « Inspecteur » (Agence A001, portée UNIT)' },
      { user: { id: USERS[1]?.id ?? USERS[0].id, displayName: USERS[1]?.displayName ?? USERS[0].displayName }, via: 'Position « Chef de mission » (Inspection Générale, portée UNIT_TREE)' },
    ]);
  }),
];
