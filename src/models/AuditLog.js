import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    userName: { type: String, required: true },
    ip: { type: String, default: '' },
    entityType: { type: String, required: true },
    entityId: { type: String, required: true },
    action: { type: String, required: true },
    beforeValue: { type: mongoose.Schema.Types.Mixed, default: null },
    afterValue: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export default mongoose.model('AuditLog', auditLogSchema);
