import { adminIamHandlers } from './admin-iam.handlers';

/** Tous les handlers MSW de l'Admin Système (un groupe par fichier de contrat). */
export const handlers = [...adminIamHandlers];

export * from './admin-iam.handlers';
