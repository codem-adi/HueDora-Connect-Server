export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  ADMIN: 'admin',
  OPERATIONS_EXECUTIVE: 'operations_executive',
  REVIEWER: 'reviewer',
  READ_ONLY: 'read_only',
};

export const CAMP_STATUSES = [
  'pending_review',
  'approved',
  'rejected',
  'cancelled',
  'rescheduled',
  'executed',
];

export const CAMP_SOURCES = [
  'whatsapp',
  'email',
  'excel',
  'dashboard',
  'api',
];

export const CAMP_DURATION_OPTIONS = [3, 4, 5, 6, 8];

export const WORKING_HOURS = {
  START: 8,
  END: 20,
};

export const REACTION_THRESHOLD_WORKING_HOURS = 6;

export const STATUS_TRANSITIONS = {
  pending_review: ['approved', 'rejected'],
  approved: ['executed', 'cancelled', 'rescheduled'],
  rejected: ['pending_review'],
  cancelled: [],
  rescheduled: ['pending_review'],
  executed: [],
};

export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: ['*'],
  [ROLES.ADMIN]: [
    'camps:read',
    'camps:create',
    'camps:update',
    'camps:approve',
    'camps:execute',
    'camps:cancel',
    'camps:reschedule',
    'dashboard:read',
    'clients:read',
    'clients:create',
    'clients:update',
    'clients:delete',
    'campaigns:read',
    'audit:read',
    'import:read',
    'import:create',
    'client-masters:read',
    'client-masters:create',
    'client-masters:update',
    'client-masters:delete',
  ],
  [ROLES.OPERATIONS_EXECUTIVE]: [
    'dashboard:read',
    'clients:read',
    'campaigns:read',
  ],
  [ROLES.REVIEWER]: [
    'camps:read',
    'camps:review',
    'dashboard:read',
    'clients:read',
    'campaigns:read',
  ],
  [ROLES.READ_ONLY]: ['camps:read', 'dashboard:read', 'clients:read', 'campaigns:read'],
};
