import { normalizeCampName } from '../config/campNames.js';
import Camp from '../models/Camp.js';
import { computeEndTime, generateCampId } from '../utils/campHelpers.js';
import { captureSubmissionTracking } from '../utils/reactionHelpers.js';

export async function createCampFromRow({
  row,
  client,
  createdBy,
  source = 'api',
  submittedAt,
  extras = {},
}) {
  const campId = await generateCampId(row.campDate);
  const durationHours = Number(row.durationHours) || 3;
  const startTime = row.startTime || '09:00';
  const endTime = row.endTime || computeEndTime(startTime, durationHours);
  const tracking = captureSubmissionTracking(submittedAt || new Date());

  const payload = {
    campId,
    client: client._id,
    clientName: client.name,
    campaignName: normalizeCampName(row.campaignName),
    campaignType: row.campaignType,
    doctorName: row.doctorName,
    doctorCode: row.doctorCode,
    scCode: row.scCode,
    mslNo: row.mslNo,
    speciality: row.speciality,
    hospitalName: row.hospitalName,
    clinicName: row.clinicName,
    campAddress: row.campAddress,
    city: row.city,
    state: row.state,
    pincode: row.pincode,
    campDate: row.campDate,
    startTime,
    endTime,
    durationHours,
    expectedPatients: row.expectedPatients,
    actualPatients: row.actualPatients,
    fieldPersonName: row.fieldPersonName,
    fieldPersonPhone: row.fieldPersonPhone,
    technicianName: row.technicianName,
    remarks: row.remarks,
    source,
    status: 'pending_review',
    createdBy: createdBy._id,
    ...tracking,
    ...extras,
  };

  for (const key of ['whatsappMessageId', 'emailIngestId']) {
    if (payload[key] == null || payload[key] === '') {
      delete payload[key];
    }
  }

  return Camp.create(payload);
}
