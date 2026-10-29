import { http, HttpResponse } from 'msw';
import type {
  AlertRule, ErrorGroup, AuditEventPage, ComponentHealth, ScheduledJob, CacheRegion, Connector, ConnectorExecutionPage, EvictionResult, Job, ListSavedLogQueries200ResponseInner,
  LogLevelOverride, LogQuery, LogResultPage, SaveLogQueryRequest,
} from '../api-clients/operations';

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

const act = (enabled: boolean): NonNullable<Connector['availableActions']> => [
  { code: 'test', label: 'Tester la connexion' },
  enabled ? { code: 'disable', label: 'Désactiver', style: 'danger', requiresComment: true } : { code: 'enable', label: 'Activer' },
];
const CONNECTORS: Connector[] = [
  {
    id: '00000000-0000-0000-0000-0000000000c1', version: 1, code: 'ERP-CORE', kind: 'REST', erpType: 'CBS',
    endpoint: 'https://erp.example.test/api', timeoutMs: 5000, enabled: true, health: 'UP', circuitBreaker: 'CLOSED',
    lastExecutionAt: '2026-02-03T09:00:00Z', lastTestResult: { success: true, latencyMs: 84, message: 'OK' },
    availableActions: act(true),
  },
  {
    id: '00000000-0000-0000-0000-0000000000c2', version: 1, code: 'ERP-LEGACY', kind: 'SOAP',
    endpoint: 'https://legacy.example.test/ws', timeoutMs: 8000, enabled: false, health: 'DOWN', circuitBreaker: 'OPEN',
    availableActions: act(false),
  },
];
const EXECUTIONS: ConnectorExecutionPage = {
  page: 0, size: 20, totalItems: 2, totalPages: 1,
  items: [
    { at: '2026-02-03T09:00:00Z', operation: 'pullAccounts', outcome: 'SUCCESS', durationMs: 412, records: 1280 },
    { at: '2026-02-03T08:00:00Z', operation: 'pullAccounts', outcome: 'RETRIED', durationMs: 5120, records: 1280 },
  ],
};

/** Régions de cache Ehcache (OPS-07) : entrées, mémoire, taux de succès, dernière purge, état par instance. */
const CACHE_NODES = ['backend-app-1', 'backend-app-2'];
const CACHES: CacheRegion[] = [
  {
    region: 'iam-structure', entries: 412, heapBytes: 1843200, hitRatio: 0.97, ttl: 'PT1H',
    lastEviction: { at: '2026-02-03T07:30:00Z', by: { id: '00000000-0000-0000-0000-0000000000f3', displayName: 'Salma Benali' }, reason: 'Mise à jour de l’organigramme' },
    instances: [{ node: CACHE_NODES[0], entries: 206 }, { node: CACHE_NODES[1], entries: 206 }],
  },
  {
    region: 'parametrage', entries: 96, heapBytes: 524288, hitRatio: 0.88, ttl: 'PT15M',
    instances: [{ node: CACHE_NODES[0], entries: 48 }, { node: CACHE_NODES[1], entries: 48 }],
  },
  {
    region: 'theme', entries: 4, heapBytes: 65536, hitRatio: 0.99, ttl: 'PT24H',
    instances: [{ node: CACHE_NODES[0], entries: 2 }, { node: CACHE_NODES[1], entries: 2 }],
  },
];
/** Purge diffusée à toutes les instances : accusés par instance (« N/N instances purgées »). */
const evictionResult = (): EvictionResult => ({ instancesExpected: CACHE_NODES.length, instancesAcknowledged: CACHE_NODES.length });
const purged = (c: CacheRegion, reason: string): CacheRegion => ({
  ...c,
  entries: 0,
  lastEviction: { at: new Date().toISOString(), by: { id: '00000000-0000-0000-0000-0000000000f3', displayName: 'Salma Benali' }, reason },
  instances: c.instances?.map((i) => ({ ...i, entries: 0 })),
});

/** Logs (OPS-08) : lignes ECS (§10.3) datées relativement à maintenant pour que la période par défaut contienne des données. */
const minutesAgo = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const LOGS: { stream: LogQuery.StreamEnum; line: Record<string, unknown> }[] = [
  { stream: 'TECHNICAL', line: { '@timestamp': minutesAgo(2), 'log.level': 'ERROR', 'log.logger': 'continuum.integration', message: 'Connecteur ERP-LEGACY indisponible (timeout 8000 ms)', 'event.code': 'CTN-INT-0102', 'trace.id': '4bf92f3577b34da6', 'service.name': 'continuum-backend', node: 'backend-app-2' } },
  { stream: 'TECHNICAL', line: { '@timestamp': minutesAgo(5), 'log.level': 'WARN', 'log.logger': 'continuum.integration', message: 'Nouvelle tentative pullAccounts (1/3)', 'trace.id': '4bf92f3577b34da6', 'service.name': 'continuum-backend', node: 'backend-app-1' } },
  { stream: 'TECHNICAL', line: { '@timestamp': minutesAgo(9), 'log.level': 'INFO', 'log.logger': 'continuum.iam', message: 'Affectation ASG-2026-0117 créée', 'trace.id': '9a1c7e3b5d2f4a60', 'service.name': 'continuum-backend', node: 'backend-app-1' } },
  { stream: 'TECHNICAL', line: { '@timestamp': minutesAgo(14), 'log.level': 'DEBUG', 'log.logger': 'continuum.integration', message: 'Réponse ERP-CORE reçue en 84 ms', 'trace.id': '2e8b4d1f6a9c0375', 'service.name': 'continuum-backend', node: 'backend-app-2' } },
  { stream: 'SECURITY', line: { '@timestamp': minutesAgo(20), 'log.level': 'WARN', 'log.logger': 'continuum.security', message: 'Surcharge de niveau activée pour continuum.integration', 'event.code': 'CTN-SEC-0010', 'trace.id': '7d3a9f2e1b8c4d05', 'service.name': 'continuum-backend', node: 'backend-app-1' } },
];
let SAVED_QUERIES: ListSavedLogQueries200ResponseInner[] = [
  { id: '00000000-0000-0000-0000-0000000000d1', label: 'Erreurs d’intégration', query: { stream: 'TECHNICAL', from: minutesAgo(60), to: minutesAgo(0), levels: ['ERROR', 'WARN'], modules: ['continuum.integration'] } },
];
/** Surcharges de niveau (OPS-08, onglet « Niveaux de log ») : expirées automatiquement, la durée par défaut étant PT30M. */
let LOG_LEVELS: LogLevelOverride[] = [
  { id: '00000000-0000-0000-0000-0000000000e1', logger: 'continuum.integration', level: 'DEBUG', entityCode: 'A001', expiresIn: 'PT30M',
    expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(), reason: 'Diagnostic des tentatives de synchronisation',
    setBy: { id: '00000000-0000-0000-0000-0000000000f3', displayName: 'Salma Benali' } },
];
/** Durée ISO-8601 limitée aux heures et minutes (`PT30M`, `PT1H`) ; `undefined` si non reconnue. */
const durationMs = (iso: string): number | undefined => {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?$/.exec(iso);
  return m && (m[1] || m[2]) ? ((Number(m[1] ?? 0) * 60) + Number(m[2] ?? 0)) * 60_000 : undefined;
};

export const operationsHandlers = [
  // Logs (OPS-08) : la recherche filtre par flux, niveaux, texte, référence de trace, période (from/to).
  http.post('*/api/admin/logs/search', async ({ request }) => {
    const q = (await request.json()) as LogQuery;
    const text = q.text?.toLowerCase();
    const from = Date.parse(q.from);
    const to = Date.parse(q.to);
    const items = LOGS.filter(({ stream, line }) => {
      const ts = Date.parse(String(line['@timestamp']));
      return stream === q.stream
        && ts >= from && ts <= to
        && (!q.levels?.length || q.levels.includes(line['log.level'] as LogQuery.LevelsEnum))
        && (!q.traceId || line['trace.id'] === q.traceId)
        && (!text || String(line['message']).toLowerCase().includes(text))
        && (!q.eventCodes?.length || q.eventCodes.includes(String(line['event.code'])))
        && (!q.modules?.length || q.modules.includes(String(line['log.logger'])));
    }).map((l) => l.line);
    const page: LogResultPage = { page: 0, size: 20, totalItems: items.length, totalPages: 1, items };
    return HttpResponse.json(page);
  }),
  http.get('*/api/admin/logs/saved-queries', () => HttpResponse.json(SAVED_QUERIES)),
  http.post('*/api/admin/logs/saved-queries', async ({ request }) => {
    const body = (await request.json()) as SaveLogQueryRequest;
    const created: ListSavedLogQueries200ResponseInner = { id: `00000000-0000-0000-0000-0000000000d${SAVED_QUERIES.length + 2}`, label: body.label, query: body.query };
    SAVED_QUERIES = [...SAVED_QUERIES, created];
    return HttpResponse.json(created, { status: 201 });
  }),
  http.delete('*/api/admin/logs/saved-queries/:queryId', ({ params }) => {
    if (!SAVED_QUERIES.some((q) => q.id === params['queryId'])) return new HttpResponse(null, { status: 404 });
    SAVED_QUERIES = SAVED_QUERIES.filter((q) => q.id !== params['queryId']);
    return new HttpResponse(null, { status: 204 });
  }),
  http.get('*/api/admin/log-levels', () => {
    LOG_LEVELS = LOG_LEVELS.filter((l) => Date.parse(l.expiresAt ?? '') > Date.now());
    return HttpResponse.json(LOG_LEVELS);
  }),
  http.post('*/api/admin/log-levels', async ({ request }) => {
    const body = (await request.json()) as LogLevelOverride;
    const ttl = durationMs(body.expiresIn);
    // Motif de 10 caractères au moins (minLength du contrat, journalisé CTN-SEC-0010) ; durée ISO reconnue.
    if (!body.logger || (body.reason ?? '').length < 10 || ttl === undefined) {
      return HttpResponse.json({ title: 'Surcharge invalide' }, { status: 422 });
    }
    const created: LogLevelOverride = {
      ...body,
      id: `00000000-0000-0000-0000-0000000000e${LOG_LEVELS.length + 2}`,
      expiresAt: new Date(Date.now() + ttl).toISOString(),
      setBy: { id: '00000000-0000-0000-0000-0000000000f3', displayName: 'Salma Benali' },
    };
    LOG_LEVELS = [...LOG_LEVELS, created];
    return HttpResponse.json(created, { status: 201 });
  }),

  // Caches de paramétrage (OPS-07) : le motif est obligatoire (minLength 10 du contrat, sinon 422).
  http.get('*/api/admin/caches', () => HttpResponse.json(CACHES)),
  http.delete('*/api/admin/caches', ({ request }) => {
    const reason = new URL(request.url).searchParams.get('reason') ?? '';
    if (reason.length < 10) return HttpResponse.json({ title: 'Motif obligatoire' }, { status: 422 });
    CACHES.forEach((c, i) => (CACHES[i] = purged(c, reason)));
    return HttpResponse.json(evictionResult());
  }),
  http.delete('*/api/admin/caches/:region', ({ params, request }) => {
    const reason = new URL(request.url).searchParams.get('reason') ?? '';
    if (reason.length < 10) return HttpResponse.json({ title: 'Motif obligatoire' }, { status: 422 });
    const i = CACHES.findIndex((c) => c.region === params['region']);
    if (i < 0) return new HttpResponse(null, { status: 404 });
    CACHES[i] = purged(CACHES[i], reason);
    return HttpResponse.json(evictionResult());
  }),
  http.post('*/api/admin/caches/warmup', () => {
    const job: Job = { id: '00000000-0000-0000-0000-0000000000b1', type: 'CACHE_WARMUP', status: 'QUEUED' };
    return HttpResponse.json(job, { status: 202 });
  }),

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
  http.get('*/api/admin/connectors', () => HttpResponse.json(CONNECTORS)),
  http.get('*/api/admin/connectors/:id/executions', () => HttpResponse.json(EXECUTIONS)),
  http.post('*/api/admin/connectors/:id/actions/:code', async ({ params }) => {
    const c = CONNECTORS.find((x) => x.id === params['id']);
    if (!c) return new HttpResponse(null, { status: 404 });
    if (params['code'] === 'test') c.lastTestResult = { success: true, latencyMs: 91, message: 'Connexion OK' };
    if (params['code'] === 'enable' || params['code'] === 'disable') {
      c.enabled = params['code'] === 'enable';
      c.availableActions = act(c.enabled);
    }
    return HttpResponse.json(c);
  }),
];

/** Clé localStorage de surcharge e2e de la supervision (OPS-11) : `forbidden` (403), `error` (500), `empty` (aucun composant), `slow` (réponse différée). */
const HEALTH_KEY = 'ct-mock-health';
const healthMode = () => (typeof localStorage === 'undefined' ? null : localStorage.getItem(HEALTH_KEY));

const HEALTH: ComponentHealth[] = [
  {
    component: 'database', node: 'pg-primary', status: 'UP', checkedAt: '2026-02-03T09:00:00Z',
    schemaVersions: [
      { entityCode: 'BANQUE-DEMO', schemaName: 'entity_banque_demo', appliedVersion: '202609181200', expectedVersion: '202609181200', pendingMigrations: 0 },
      { entityCode: 'ASSUR-DEMO', schemaName: 'entity_assur_demo', appliedVersion: '202609011000', expectedVersion: '202609181200', pendingMigrations: 2 },
    ],
  },
  { component: 'broker', node: 'broker-1', status: 'UP', checkedAt: '2026-02-03T09:00:00Z' },
  { component: 'keycloak', node: 'kc-1', status: 'DEGRADED', detail: 'Latence élevée sur le endpoint de jetons', checkedAt: '2026-02-03T09:00:00Z' },
  { component: 'opensearch', node: 'os-1', status: 'DOWN', detail: 'Connexion refusée', checkedAt: '2026-02-03T08:59:30Z' },
];

const SCHEDULED_JOBS: ScheduledJob[] = [
  { code: 'ccm-nightly', label: 'Exécution nocturne des contrôles CCM', state: 'ACTIVE', cron: '0 0 2 * * *', lastRunAt: '2026-02-03T02:00:00Z', lastOutcome: 'SUCCESS', nextRunAt: '2026-02-04T02:00:00Z' },
  { code: 'purge-retention', label: 'Purge de rétention', state: 'FAILED', cron: '0 30 3 * * *', lastRunAt: '2026-02-03T03:30:00Z', lastOutcome: 'FAILURE', nextRunAt: '2026-02-04T03:30:00Z' },
];

export const healthHandlers = [
  http.get('*/api/admin/health', async () => {
    const mode = healthMode();
    if (mode === 'forbidden') return new HttpResponse(null, { status: 403 });
    if (mode === 'error') return new HttpResponse(null, { status: 500 });
    if (mode === 'slow') await new Promise((r) => setTimeout(r, 1200));
    return HttpResponse.json(mode === 'empty' ? [] : HEALTH);
  }),
  http.get('*/api/admin/scheduled-jobs', () => {
    const mode = healthMode();
    if (mode === 'forbidden') return new HttpResponse(null, { status: 403 });
    return HttpResponse.json(mode === 'empty' ? [] : SCHEDULED_JOBS);
  }),
];

/** Clé localStorage de surcharge e2e d'OPS-10 : `forbidden` (403 sur erreurs et règles), `error` (500), `empty` (aucune erreur). */
const ERRORS_KEY = 'ct-mock-errors';
const errorsMode = () => (typeof localStorage === 'undefined' ? null : localStorage.getItem(ERRORS_KEY));

const ERROR_GROUPS: ErrorGroup[] = [
  {
    eventCode: 'CTN-INT-0102', label: 'Appel ERP en échec après les tentatives', level: 'ERROR', occurrences: 42,
    firstSeenAt: '2026-02-03T06:10:00Z', lastSeenAt: '2026-02-03T09:05:00Z', nodes: ['app-1', 'app-2'],
    trend: [{ at: '2026-02-03T08:00:00Z', count: 10 }, { at: '2026-02-03T09:00:00Z', count: 32 }],
    runbook: '1. Vérifier l’état du connecteur (OPS-CONN-01).\n2. Tester la connexion.\n3. Escalader au prestataire si l’indisponibilité dépasse 30 min.',
  },
  {
    eventCode: 'CTN-WFL-0007', label: 'Tâche de workflow expirée', level: 'WARN', occurrences: 5,
    firstSeenAt: '2026-02-02T10:00:00Z', lastSeenAt: '2026-02-03T07:00:00Z', nodes: ['app-1'],
    trend: [{ at: '2026-02-03T08:00:00Z', count: 3 }, { at: '2026-02-03T09:00:00Z', count: 2 }],
    runbook: 'Relancer la tâche depuis la console de workflow.',
  },
];

const ruleActions = (enabled: boolean): NonNullable<AlertRule['availableActions']> => [
  { code: 'edit', label: 'Modifier' },
  { code: enabled ? 'disable' : 'enable', label: enabled ? 'Désactiver' : 'Activer' },
  { code: 'delete', label: 'Supprimer', style: 'danger' },
];
const withActions = (r: AlertRule): AlertRule => ({ ...r, availableActions: ruleActions(r.enabled ?? true) });

let ALERT_RULES: AlertRule[] = [
  { id: '00000000-0000-0000-0000-0000000000c1', label: 'CBS indisponible', eventCode: 'CTN-INT-0102', threshold: 5, window: 'PT10M', channels: ['IN_APP', 'EMAIL'], enabled: true },
];

export const alertsHandlers = [
  http.get('*/api/admin/errors', () => {
    const mode = errorsMode();
    if (mode === 'forbidden') return new HttpResponse(null, { status: 403 });
    if (mode === 'error') return new HttpResponse(null, { status: 500 });
    return HttpResponse.json(mode === 'empty' ? [] : ERROR_GROUPS);
  }),
  http.get('*/api/admin/alert-rules', () => {
    if (errorsMode() === 'forbidden') return new HttpResponse(null, { status: 403 });
    return HttpResponse.json(ALERT_RULES.map(withActions));
  }),
  http.post('*/api/admin/alert-rules', async ({ request }) => {
    const rule: AlertRule = { ...((await request.json()) as AlertRule), id: crypto.randomUUID() };
    ALERT_RULES = [...ALERT_RULES, rule];
    return HttpResponse.json(rule, { status: 201 });
  }),
  http.put('*/api/admin/alert-rules/:id', async ({ params, request }) => {
    const rule: AlertRule = { ...((await request.json()) as AlertRule), id: params['id'] as string };
    ALERT_RULES = ALERT_RULES.map((r) => (r.id === rule.id ? rule : r));
    return HttpResponse.json(rule);
  }),
  http.delete('*/api/admin/alert-rules/:id', ({ params }) => {
    ALERT_RULES = ALERT_RULES.filter((r) => r.id !== params['id']);
    return new HttpResponse(null, { status: 204 });
  }),
];
