import mongoose from 'mongoose';
import { CAMP_NAME_OPTIONS, normalizeCampName } from '../config/campNames.js';
import { CAMP_SOURCES, CAMP_STATUSES, CANCELLATION_SOURCES } from '../config/constants.js';

const campSchema = new mongoose.Schema(
  {
    campId: { type: String, unique: true, required: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
    clientName: { type: String, required: true },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    campaignName: {
      type: String,
      enum: CAMP_NAME_OPTIONS,
      required: true,
      set: normalizeCampName,
    },
    campaignType: { type: String, required: true },
    doctorName: { type: String, default: '' },
    doctorCode: { type: String, default: '' },
    scCode: { type: String, default: '' },
    mslNo: { type: String, default: '' },
    speciality: { type: String, default: '' },
    hospitalName: { type: String, default: '' },
    clinicName: { type: String, default: '' },
    campAddress: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    pincode: { type: String, default: '' },
    campDate: { type: Date, required: true },
    startTime: { type: String, default: '' },
    endTime: { type: String, default: '' },
    durationHours: { type: Number, default: 3, min: 1, max: 12 },
    expectedPatients: { type: Number, default: 0 },
    actualPatients: { type: Number, default: 0 },
    fieldPersonName: { type: String, default: '' },
    fieldPersonPhone: { type: String, default: '' },
    technicianName: { type: String, default: '' },
    source: { type: String, enum: CAMP_SOURCES, default: 'dashboard' },
    whatsappMessageId: { type: String, unique: true, sparse: true },
    whatsappSenderPhone: { type: String, default: '' },
    whatsappRawMessage: { type: String, default: '' },
    emailIngestId: { type: String, unique: true, sparse: true },
    emailMessageId: { type: String, default: '' },
    emailSender: { type: String, default: '' },
    emailSubject: { type: String, default: '' },
    emailRawBody: { type: String, default: '' },
    status: { type: String, enum: CAMP_STATUSES, default: 'pending_review' },
    cancelledBy: { type: String, enum: CANCELLATION_SOURCES, default: null },
    remarks: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    executedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    executedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: null },
    submittedOffHours: { type: Boolean, default: false },
    submittedWeekendAttention: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

campSchema.index({ status: 1, campDate: -1 });
campSchema.index({ client: 1, state: 1 });
campSchema.index({ campaignType: 1 });

campSchema.pre('validate', function normalizeCampaignNameBeforeValidate(next) {
  if (this.campaignName) {
    this.campaignName = normalizeCampName(this.campaignName);
  }
  next();
});

export default mongoose.model('Camp', campSchema);
