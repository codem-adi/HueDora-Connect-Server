import Camp from '../models/Camp.js';
import Client from '../models/Client.js';
import Campaign from '../models/Campaign.js';
import { ROLES } from '../config/constants.js';
import { logAudit } from '../services/auditService.js';
import { normalizeCampName } from '../config/campNames.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { assertClientHasDivision } from '../utils/clientDivisionValidation.js';
import { buildPaginationMeta, parsePaginationQuery } from '../utils/pagination.js';
import {
  buildCampFilter,
  canTransition,
  computeEndTime,
  generateCampId,
  isCampEditable,
  isCampOverdue,
  parseLocalDateInput,
  resolveClinicHospitalName,
  withCampSchedule,
} from '../utils/campHelpers.js';
import { captureSubmissionTracking, getReactionAlert, matchesAlertFilter } from '../utils/reactionHelpers.js';
import {
  enrichCampsWithApprovalStatus,
  validateCampReadyForApproval,
} from '../utils/campApprovalValidation.js';

function applyScheduleFields(body) {
  const durationHours = Number(body.durationHours) || 3;
  const startTime = body.startTime || '09:00';
  const endTime = body.endTime || computeEndTime(startTime, durationHours);

  return {
    durationHours,
    startTime,
    endTime,
  };
}

export const listCamps = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const overdueOnly = req.query.overdue === '1' || req.query.overdue === 'true';
  const reactionRequired = req.query.reactionRequired === '1' || req.query.reactionRequired === 'true';
  const offHours = req.query.offHours === '1' || req.query.offHours === 'true';
  const weekendAttention = req.query.weekendAttention === '1' || req.query.weekendAttention === 'true';
  const alertFilter = reactionRequired || offHours || weekendAttention;
  const filter = buildCampFilter(req.query);

  if (overdueOnly) {
    filter.status = 'approved';
    const approvedCamps = await Camp.find(filter)
      .populate('client', 'name code')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ campDate: -1, createdAt: -1 });

    const overdueCamps = approvedCamps.filter(isCampOverdue).map(withCampSchedule);
    const total = overdueCamps.length;
    const data = overdueCamps.slice(skip, skip + limit);

    return res.json({
      data,
      pagination: buildPaginationMeta(page, limit, total),
    });
  }

  if (alertFilter) {
    filter.status = 'pending_review';
    const pendingCamps = await Camp.find(filter)
      .populate('client', 'name code')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ campDate: -1, createdAt: -1 });

    const filteredCamps = pendingCamps
      .filter((camp) => matchesAlertFilter(camp, req.query))
      .map(withCampSchedule);
    const total = filteredCamps.length;
    const data = filteredCamps.slice(skip, skip + limit);

    return res.json({
      data,
      pagination: buildPaginationMeta(page, limit, total),
    });
  }

  const [camps, total] = await Promise.all([
    Camp.find(filter)
      .populate('client', 'name code isActive')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .sort({ campDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Camp.countDocuments(filter),
  ]);

  const enriched = await enrichCampsWithApprovalStatus(camps);

  res.json({
    data: enriched.map(withCampSchedule),
    pagination: buildPaginationMeta(page, limit, total),
  });
});

export const getCamp = asyncHandler(async (req, res) => {
  const camp = await Camp.findOne({ _id: req.params.id, deletedAt: null })
    .populate('client', 'name code isActive')
    .populate('createdBy', 'name email')
    .populate('approvedBy', 'name email');

  if (!camp) {
    return res.status(404).json({ message: 'Camp not found' });
  }

  const [enriched] = await enrichCampsWithApprovalStatus([camp]);
  res.json({ data: withCampSchedule(enriched) });
});

export const createCamp = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.body.clientId, deletedAt: null });
  if (!client) {
    return res.status(404).json({ message: 'Client not found' });
  }

  let campaign = null;
  if (req.body.campaignId) {
    campaign = await Campaign.findOne({ _id: req.body.campaignId, deletedAt: null });
    if (!campaign) {
      return res.status(404).json({ message: 'Campaign not found' });
    }
  }

  const schedule = applyScheduleFields(req.body);
  await assertClientHasDivision(client._id, req.body.campaignType);
  const campId = await generateCampId(req.body.campDate);
  const tracking = captureSubmissionTracking();
  const clinicHospital = resolveClinicHospitalName(req.body.hospitalName, req.body.clinicName);
  const camp = await Camp.create({
    campId,
    client: client._id,
    clientName: client.name,
    campaign: campaign?._id || null,
    campaignName: normalizeCampName(req.body.campaignName || campaign?.name),
    campaignType: req.body.campaignType || 'Screening',
    doctorName: req.body.doctorName,
    doctorCode: req.body.doctorCode,
    scCode: req.body.scCode,
    mslNo: req.body.mslNo,
    speciality: req.body.speciality,
    hospitalName: clinicHospital,
    clinicName: '',
    campAddress: req.body.campAddress,
    city: req.body.city,
    state: req.body.state,
    pincode: req.body.pincode,
    campDate: req.body.campDate,
    ...schedule,
    expectedPatients: req.body.expectedPatients,
    actualPatients: req.body.actualPatients,
    fieldPersonName: req.body.fieldPersonName,
    fieldPersonPhone: req.body.fieldPersonPhone,
    technicianName: req.body.technicianName,
    source: req.body.source || 'excel',
    status: 'pending_review',
    remarks: req.body.remarks,
    createdBy: req.user._id,
    ...tracking,
  });

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'camp',
    entityId: camp._id,
    action: 'create',
    afterValue: camp.toObject(),
  });

  res.status(201).json({ data: withCampSchedule(camp) });
});

export const updateCamp = asyncHandler(async (req, res) => {
  const camp = await Camp.findOne({ _id: req.params.id, deletedAt: null });
  if (!camp) {
    return res.status(404).json({ message: 'Camp not found' });
  }

  if (!isCampEditable(camp.status)) {
    return res.status(400).json({ message: 'Executed or cancelled camps cannot be edited' });
  }

  const before = camp.toObject();

  if (req.body.clientId !== undefined) {
    const client = await Client.findOne({ _id: req.body.clientId, deletedAt: null });
    if (!client) {
      return res.status(404).json({ message: 'Client not found' });
    }
    camp.client = client._id;
    camp.clientName = client.name;
  }

  const divisionClientId = req.body.clientId ?? camp.client;
  const divisionValue = req.body.campaignType ?? camp.campaignType;
  if (req.body.clientId !== undefined || req.body.campaignType !== undefined) {
    await assertClientHasDivision(divisionClientId, divisionValue);
  }

  if (req.body.campDate !== undefined) {
    const parsedDate = parseLocalDateInput(req.body.campDate);
    if (!parsedDate) {
      return res.status(400).json({ message: 'Invalid camp date' });
    }
    camp.campDate = parsedDate;
  }

  const editableFields = [
    'campaignName', 'campaignType', 'doctorName', 'doctorCode', 'scCode', 'mslNo',
    'speciality', 'campAddress', 'city', 'state',
    'pincode', 'startTime', 'endTime', 'durationHours', 'expectedPatients',
    'actualPatients', 'fieldPersonName', 'fieldPersonPhone', 'technicianName', 'remarks',
  ];

  editableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      camp[field] = req.body[field];
    }
  });

  if (req.body.hospitalName !== undefined || req.body.clinicName !== undefined) {
    camp.hospitalName = resolveClinicHospitalName(
      req.body.hospitalName ?? camp.hospitalName,
      req.body.clinicName ?? camp.clinicName,
    );
    camp.clinicName = '';
  }

  if (req.body.durationHours !== undefined || req.body.startTime !== undefined) {
    camp.endTime = req.body.endTime || computeEndTime(camp.startTime, camp.durationHours);
  }

  await camp.save();
  await camp.populate('client', 'name code');

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'camp',
    entityId: camp._id,
    action: 'update',
    beforeValue: before,
    afterValue: camp.toObject(),
  });

  res.json({ data: withCampSchedule(camp) });
});

function applyRescheduleFields(camp, body) {
  if (body.campDate !== undefined) {
    const parsedDate = parseLocalDateInput(body.campDate);
    if (!parsedDate) {
      const error = new Error('Invalid camp date');
      error.status = 400;
      throw error;
    }
    camp.campDate = parsedDate;
  }

  if (body.startTime !== undefined) camp.startTime = body.startTime;
  if (body.durationHours !== undefined) camp.durationHours = Number(body.durationHours) || camp.durationHours;
  if (body.endTime !== undefined) camp.endTime = body.endTime;

  if (body.durationHours !== undefined || body.startTime !== undefined) {
    camp.endTime = body.endTime || computeEndTime(camp.startTime, camp.durationHours);
  }
}

async function transitionCamp(req, res, nextStatus, action) {
  const camp = await Camp.findOne({ _id: req.params.id, deletedAt: null });
  if (!camp) {
    return res.status(404).json({ message: 'Camp not found' });
  }

  if (!canTransition(camp.status, nextStatus, req.user.role)) {
    return res.status(400).json({
      message: `Cannot transition from ${camp.status} to ${nextStatus}`,
    });
  }

  if (nextStatus === 'approved') {
    await camp.populate('client', 'name code isActive');
    const approvalCheck = await validateCampReadyForApproval(camp);
    if (!approvalCheck.canApprove) {
      return res.status(400).json({
        message: approvalCheck.errors[0],
        errors: approvalCheck.errors,
      });
    }
  }

  const before = camp.toObject();
  camp.status = nextStatus;

  if (nextStatus === 'pending_review') {
    Object.assign(camp, captureSubmissionTracking());
  }

  if (nextStatus === 'approved') {
    camp.approvedBy = req.user._id;
  }

  if (nextStatus === 'executed') {
    camp.executedBy = req.user._id;
    camp.executedAt = new Date();
  }

  if (nextStatus === 'rescheduled') {
    try {
      applyRescheduleFields(camp, req.body || {});
    } catch (err) {
      return res.status(err.status || 400).json({ message: err.message || 'Invalid reschedule details' });
    }
  }

  if (req.body?.remarks) {
    camp.remarks = req.body.remarks;
  }

  await camp.save();

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'camp',
    entityId: camp._id,
    action,
    beforeValue: before,
    afterValue: camp.toObject(),
  });

  res.json({ data: withCampSchedule(camp) });
}

export const submitForReview = (req, res) => transitionCamp(req, res, 'pending_review', 'submit_review');
export const approveCamp = (req, res) => transitionCamp(req, res, 'approved', 'approve');
export const rejectCamp = (req, res) => transitionCamp(req, res, 'rejected', 'reject');
export const cancelCamp = (req, res) => transitionCamp(req, res, 'cancelled', 'cancel');
export const rescheduleCamp = (req, res) => transitionCamp(req, res, 'rescheduled', 'reschedule');
export const executeCamp = (req, res) => transitionCamp(req, res, 'executed', 'execute');

export const softDeleteCamp = asyncHandler(async (req, res) => {
  const camp = await Camp.findOne({ _id: req.params.id, deletedAt: null });
  if (!camp) {
    return res.status(404).json({ message: 'Camp not found' });
  }

  if (req.user.role !== ROLES.SUPER_ADMIN && camp.status === 'executed') {
    return res.status(400).json({ message: 'Executed camps cannot be deleted' });
  }

  const before = camp.toObject();
  camp.deletedAt = new Date();
  await camp.save();

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'camp',
    entityId: camp._id,
    action: 'soft_delete',
    beforeValue: before,
    afterValue: camp.toObject(),
  });

  res.json({ message: 'Camp archived successfully' });
});

const BULK_ACTIONS = {
  approve: { nextStatus: 'approved', from: ['pending_review'], action: 'bulk_approve' },
  reject: { nextStatus: 'rejected', from: ['pending_review'], action: 'bulk_reject' },
  execute: { nextStatus: 'executed', from: ['approved'], action: 'bulk_execute' },
  reschedule: { nextStatus: 'rescheduled', from: ['approved', 'executed'], action: 'bulk_reschedule' },
  delete: { action: 'bulk_delete' },
};

function canBulkTransition(camp, nextStatus, userRole) {
  if (nextStatus === 'rescheduled' && camp.status === 'executed') {
    return userRole === ROLES.SUPER_ADMIN;
  }
  return canTransition(camp.status, nextStatus, userRole);
}

export const bulkAction = asyncHandler(async (req, res) => {
  const { ids, action } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ message: 'Select at least one camp' });
  }

  const config = BULK_ACTIONS[action];
  if (!config) {
    return res.status(400).json({ message: 'Invalid bulk action' });
  }

  const camps = await Camp.find({ _id: { $in: ids }, deletedAt: null });
  const results = { success: [], failed: [] };

  for (const camp of camps) {
    try {
      if (action === 'delete') {
        if (req.user.role !== ROLES.SUPER_ADMIN && camp.status === 'executed') {
          throw new Error('Executed camps cannot be deleted');
        }
        const before = camp.toObject();
        camp.deletedAt = new Date();
        await camp.save();
        await logAudit({
          user: req.user,
          ip: req.ip,
          entityType: 'camp',
          entityId: camp._id,
          action: config.action,
          beforeValue: before,
          afterValue: camp.toObject(),
        });
        results.success.push({ id: camp._id, campId: camp.campId });
        continue;
      }

      if (config.from && !config.from.includes(camp.status)) {
        if (!(action === 'reschedule' && camp.status === 'executed' && req.user.role === ROLES.SUPER_ADMIN)) {
          throw new Error(`Camp ${camp.campId} is ${camp.status} and cannot be ${action}d`);
        }
      }

      if (!canBulkTransition(camp, config.nextStatus, req.user.role)) {
        throw new Error(`Camp ${camp.campId} cannot move to ${config.nextStatus}`);
      }

      if (config.nextStatus === 'approved') {
        await camp.populate('client', 'name code isActive');
        const approvalCheck = await validateCampReadyForApproval(camp);
        if (!approvalCheck.canApprove) {
          throw new Error(approvalCheck.errors[0]);
        }
      }

      const before = camp.toObject();
      camp.status = config.nextStatus;
      if (config.nextStatus === 'approved') {
        camp.approvedBy = req.user._id;
      }
      if (config.nextStatus === 'executed') {
        camp.executedBy = req.user._id;
        camp.executedAt = new Date();
      }
      await camp.save();

      await logAudit({
        user: req.user,
        ip: req.ip,
        entityType: 'camp',
        entityId: camp._id,
        action: config.action,
        beforeValue: before,
        afterValue: camp.toObject(),
      });

      results.success.push({ id: camp._id, campId: camp.campId });
    } catch (err) {
      results.failed.push({ id: camp._id, campId: camp.campId, reason: err.message });
    }
  }

  res.json({
    message: `Bulk ${action} finished`,
    summary: {
      requested: ids.length,
      processed: camps.length,
      success: results.success.length,
      failed: results.failed.length,
    },
    results,
  });
});
