import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, default: '' },
    contentType: { type: String, default: '' },
    size: { type: Number, default: 0 },
    content: { type: Buffer, default: null },
  },
  { _id: false }
);

const inboundEmailSchema = new mongoose.Schema(
  {
    messageId: { type: String, required: true, unique: true, trim: true },
    imapUid: { type: Number, default: null },
    from: { type: String, default: '' },
    subject: { type: String, default: '' },
    bodyText: { type: String, default: '' },
    html: { type: String, default: '' },
    receivedAt: { type: Date, default: Date.now },
    attachments: { type: [attachmentSchema], default: [] },
    channel: { type: String, enum: ['imap', 'webhook'], default: 'imap' },
    status: {
      type: String,
      enum: ['inbox', 'processed', 'archived'],
      default: 'inbox',
    },
    isCampaignCandidate: { type: Boolean, default: false },
    matchSummary: { type: String, default: '' },
    skipReason: { type: String, default: '' },
    previewData: { type: mongoose.Schema.Types.Mixed, default: null },
    linkedCampIds: { type: [String], default: [] },
    processedAt: { type: Date, default: null },
    archivedAt: { type: Date, default: null },
    archivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

inboundEmailSchema.index({ status: 1, receivedAt: -1 });
inboundEmailSchema.index({ isCampaignCandidate: 1, receivedAt: -1 });

export default mongoose.model('InboundEmail', inboundEmailSchema);
