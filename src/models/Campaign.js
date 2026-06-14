import mongoose from 'mongoose';

const campaignSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    division: { type: String, required: true, trim: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    isActive: { type: Boolean, default: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

campaignSchema.index({ client: 1, division: 1 }, { unique: true });

export default mongoose.model('Campaign', campaignSchema);
