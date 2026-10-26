import { Assignment, AuthzSimulationResultExplanationInner, Position, UserAccount } from '../../libs/api-clients/admin-iam';

/**
 * Libellés d'affichage (français) des énumérations fermées du contrat IAM. Il ne s'agit pas de
 * constantes métier paramétrables (§ paramétrage) mais de la traduction d'énumérations techniques
 * du contrat (statut de compte, source, type/état d'affectation) : fermées, vraies pour tout tenant.
 */
export const ACCOUNT_STATUS_LABELS: Record<UserAccount.AccountStatusEnum, string> = {
  ACTIVE: 'Actif',
  LOCKED: 'Verrouillé',
  DISABLED: 'Désactivé',
  NO_ASSIGNMENT: 'Sans affectation',
};

export const USER_SOURCE_LABELS: Record<UserAccount.SourceEnum, string> = {
  AD: 'Annuaire (AD)',
  LOCAL: 'Compte local',
};

export const ASSIGNMENT_KIND_LABELS: Record<Assignment.KindEnum, string> = {
  HOLDER: 'Titulaire',
  INTERIM: 'Intérim',
  DELEGATION: 'Délégation',
};

export const ASSIGNMENT_STATE_LABELS: Record<Assignment.StateEnum, string> = {
  PENDING_APPROVAL: 'En attente',
  ACTIVE: 'Active',
  FUTURE: 'À venir',
  ENDED: 'Terminée',
};

export const POSITION_SCOPE_LABELS: Record<Position.ScopeEnum, string> = {
  UNIT: 'Unité',
  UNIT_TREE: 'Unité et sous-unités',
  TENANT: 'Toute l’entité',
};

export const AUTHZ_RESULT_LABELS: Record<AuthzSimulationResultExplanationInner.ResultEnum, string> = {
  GRANTS: 'Accorde',
  DOES_NOT_COVER: 'Ne couvre pas',
  BLOCKED_BY_SOD: 'Bloqué (séparation des tâches)',
  MODULE_DISABLED: 'Module désactivé',
};
