import { setupWorker } from 'msw/browser';
import { handlers } from '../../libs/mocks';

/**
 * Service Worker MSW pour le développement de l'Admin Système (D32) : sert les contrats via les
 * handlers typés par les clients générés, sans dépendre du backend ni de Keycloak. Hors production.
 */
export const worker = setupWorker(...handlers);
