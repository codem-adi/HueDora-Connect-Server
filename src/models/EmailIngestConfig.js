import mongoose from 'mongoose';

const emailIngestConfigSchema = new mongoose.Schema(
  {
    allowedDomains: { type: [String], default: [] },
    allowedSenders: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('EmailIngestConfig', emailIngestConfigSchema);
