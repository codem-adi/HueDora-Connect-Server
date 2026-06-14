import AuditLog from '../models/AuditLog.js';

export async function logAudit({
  user,
  ip,
  entityType,
  entityId,
  action,
  beforeValue = null,
  afterValue = null,
}) {
  await AuditLog.create({
    user: user._id,
    userName: user.name,
    ip,
    entityType,
    entityId: String(entityId),
    action,
    beforeValue,
    afterValue,
  });
}
