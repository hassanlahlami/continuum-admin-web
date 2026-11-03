import { authHandlers } from './auth.handlers';
import { adminIamHandlers } from './admin-iam.handlers';
import { alertsHandlers, healthHandlers, operationsHandlers } from './operations.handlers';

/** Tous les handlers MSW de l'Admin Système (un groupe par fichier de contrat). */
export const handlers = [...authHandlers, ...adminIamHandlers, ...operationsHandlers, ...healthHandlers, ...alertsHandlers];

export * from './admin-iam.handlers';
export * from './operations.handlers';
export * from "./auth.handlers";
