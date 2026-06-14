import mongoose from 'mongoose';

const importTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null },
    mapping: {
      type: Map,
      of: String,
      default: {},
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

importTemplateSchema.index({ name: 1, createdBy: 1 });

export default mongoose.model('ImportTemplate', importTemplateSchema);
