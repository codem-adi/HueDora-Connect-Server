import { ROLES } from '../config/constants.js';

const SYSTEM_USER_EMAILS = new Set([
  (process.env.WHATSAPP_SERVICE_USER_EMAIL || 'whatsapp-bot@huedoraconnect.com').toLowerCase(),
  (process.env.EMAIL_SERVICE_USER_EMAIL || 'email-bot@huedoraconnect.com').toLowerCase(),
]);

export function isSuperAdminUser(user) {
  return user?.role === ROLES.SUPER_ADMIN;
}

export function isSystemUser(user) {
  if (!user) return false;
  const email = String(user.email || '').toLowerCase();
  return SYSTEM_USER_EMAILS.has(email) || email.endsWith('-bot@huedoraconnect.com');
}

export function isManagedUser(user) {
  if (!user || user.deletedAt) return false;
  return !isSuperAdminUser(user) && !isSystemUser(user);
}

export function buildManagedUserFilter(extra = {}) {
  return {
    deletedAt: null,
    role: { $ne: ROLES.SUPER_ADMIN },
    email: { $nin: [...SYSTEM_USER_EMAILS] },
    ...extra,
  };
}

export function getEffectiveSignupStatus(user) {
  return user?.signupStatus || 'approved';
}
