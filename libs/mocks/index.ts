import { adminIamHandlers } from './admin-iam.handlers';
import { operationsHandlers } from './operations.handlers';

/** Tous les handlers MSW de l'Admin Système (un groupe par fichier de contrat). */
export const handlers = [...adminIamHandlers, ...operationsHandlers];

export * from './admin-iam.handlers';
export * from './operations.handlers';
