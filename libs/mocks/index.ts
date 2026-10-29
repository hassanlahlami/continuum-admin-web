import { adminIamHandlers } from './admin-iam.handlers';
import { healthHandlers, operationsHandlers } from './operations.handlers';

/** Tous les handlers MSW de l'Admin Système (un groupe par fichier de contrat). */
export const handlers = [...adminIamHandlers, ...operationsHandlers, ...healthHandlers];

export * from './admin-iam.handlers';
export * from './operations.handlers';
