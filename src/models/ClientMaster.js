import mongoose from 'mongoose';
import { CAMP_NAME_OPTIONS } from '../config/campNames.js';

const clientMasterSchema = new mongoose.Schema(
  {
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    clientName: { type: String, required: true, trim: true },
    programName: { type: String, default: '', trim: true },
    drugTherapyName: { type: String, default: '', trim: true },
    campName: { type: String, enum: CAMP_NAME_OPTIONS, default: 'BMD', trim: true },
    campType: { type: String, default: '', trim: true },
    coordinatorName: { type: String, default: '', trim: true },
    healthcareWorker: { type: String, default: '', trim: true },
    poAmount: { type: Number, default: 0 },
    campDuration: { type: String, default: '', trim: true },
    spocName: { type: String, default: '', trim: true },
    spocNumber: { type: String, default: '', trim: true },
    requestTimeline: { type: String, default: '', trim: true },
    executedCampUnit: { type: Number, default: 0 },
    cancelledCampUnit: { type: Number, default: 0 },
    otUnit: { type: Number, default: 0 },
    minimumPatientCovered: { type: Number, default: 0 },
    minimumKmsCovered: { type: Number, default: 0 },
    extPatientUnit: { type: Number, default: 0 },
    kmsUnit: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    programDocument: {
      fileName: { type: String, default: '' },
      storedName: { type: String, default: '' },
      mimeType: { type: String, default: '' },
      fileSize: { type: Number, default: 0 },
      uploadedAt: { type: Date, default: null },
      uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
    deletedAt: { type: Date, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

clientMasterSchema.index({ client: 1, programName: 1, campName: 1 });
clientMasterSchema.index({ deletedAt: 1, clientName: 1 });

export default mongoose.model('ClientMaster', clientMasterSchema);
