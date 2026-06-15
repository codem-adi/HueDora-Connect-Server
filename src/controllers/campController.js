import Camp from '../models/Camp.js';
import Client from '../models/Client.js';
import Campaign from '../models/Campaign.js';
import { ROLES, ROLE_PERMISSIONS, CANCELLATION_SOURCES } from '../config/constants.js';
import { logAudit } from '../services/auditService.js';
import { normalizeCampName } from '../config/campNames.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { assertClientHasDivision } from '../utils/clientDivisionValidation.js';
import { buildPaginationMeta, parsePaginationQuery } from '../utils/pagination.js';
import {
  buildCampFilter,
  canTransition,
  generateCampId,
  isCampEditable,
  isCampOverdue,
  parseLocalDateInput,
  resolveCampSchedule,
  resolveClinicHospitalName,
  withCampSchedule,
} from '../utils/campHelpers.js';
import { findExistingDuplicateCamp } from '../utils/campDuplicateHelpers.js';
import { captureSubmissionTracking, getReactionAlert, matchesAlertFilter } from '../utils/reactionHelpers.js';
import {
  enrichCampsWithApprovalStatus,
  validateCampReadyForApproval,
} from '../utils/campApprovalValidation.js';

function applyScheduleFields(body) {
  return resolveCampSchedule({
    startTime: body.startTime || '09:00',
    endTime: body.endTime,
    durationHours: body.durationHours,
  });
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

  const duplicate = await findExistingDuplicateCamp({
    client,
    row: {
      ...req.body,
      campaignType: req.body.campaignType,
      doctorName: req.body.doctorName,
      doctorCode: req.body.doctorCode,
      campDate: req.body.campDate,
    },
  });
  if (duplicate) {
    return res.status(409).json({
      message: `Duplicate camp already exists (${duplicate.campId}) for the same client, division, date, and doctor`,
      duplicateCampId: duplicate.campId,
    });
  }

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

function userHasCampPermission(user, permissions = []) {
  const rolePerms = ROLE_PERMISSIONS[user.role] || [];
  if (rolePerms.includes('*')) return true;
  return permissions.some((permission) => rolePerms.includes(permission));
}

function userCanFullyUpdateCamp(user) {
  return userHasCampPermission(user, ['camps:update', 'camps:approve']);
}

function userCanEditPendingCamp(user) {
  return userHasCampPermission(user, ['camps:edit-pending']);
}

export const updateCamp = asyncHandler(async (req, res) => {
  const camp = await Camp.findOne({ _id: req.params.id, deletedAt: null });
  if (!camp) {
    return res.status(404).json({ message: 'Camp not found' });
  }

  if (!userCanFullyUpdateCamp(req.user)) {
    if (!userCanEditPendingCamp(req.user) || camp.status !== 'pending_review') {
      return res.status(403).json({ message: 'You can only edit camps that are pending review' });
    }
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
    'actualPatients', 'fieldPersonName', 'fieldPersonPhone', 'remarks',
  ];

  editableFields.forEach((field) => {
    if (req.body[field] !== undefined) {
      camp[field] = field === 'campaignName'
        ? normalizeCampName(req.body[field])
        : req.body[field];
    }
  });

  if (req.body.hospitalName !== undefined || req.body.clinicName !== undefined) {
    camp.hospitalName = resolveClinicHospitalName(
      req.body.hospitalName ?? camp.hospitalName,
      req.body.clinicName ?? camp.clinicName,
    );
    camp.clinicName = '';
  }

  if (req.body.durationHours !== undefined || req.body.startTime !== undefined || req.body.endTime !== undefined) {
    const schedule = resolveCampSchedule({
      startTime: req.body.startTime ?? camp.startTime,
      endTime: req.body.endTime ?? camp.endTime,
      durationHours: req.body.durationHours ?? camp.durationHours,
    });
    camp.startTime = schedule.startTime;
    camp.endTime = schedule.endTime;
    camp.durationHours = schedule.durationHours;
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

function validateCancellationPayload(body) {
  const cancelledBy = String(body?.cancelledBy || '').trim().toLowerCase();
  const remarks = String(body?.remarks || '').trim();

  if (!CANCELLATION_SOURCES.includes(cancelledBy)) {
    const error = new Error('Select who cancelled the camp: brand or KHW');
    error.status = 400;
    throw error;
  }

  if (!remarks) {
    const error = new Error('Cancellation remark is required');
    error.status = 400;
    throw error;
  }

  return { cancelledBy, remarks };
}

async function transitionCamp(req, res, nextStatus, action) {
  const camp = await Camp.findOne({ _id: req.params.id, deletedAt: null });
  if (!camp) {
    return res.status(404).json({ message: 'Camp not found' });
  }

  if (!canTransition(camp.status, nextStatus)) {
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

  if (nextStatus === 'cancelled') {
    try {
      const cancellation = validateCancellationPayload(req.body);
      camp.cancelledBy = cancellation.cancelledBy;
      camp.remarks = cancellation.remarks;
    } catch (err) {
      return res.status(err.status || 400).json({ message: err.message || 'Invalid cancellation details' });
    }
  } else if (req.body?.remarks) {
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

export const submitForReview = asyncHandler(async (req, res) => transitionCamp(req, res, 'pending_review', 'submit_review'));
export const approveCamp = asyncHandler(async (req, res) => transitionCamp(req, res, 'approved', 'approve'));
export const rejectCamp = asyncHandler(async (req, res) => transitionCamp(req, res, 'rejected', 'reject'));
export const cancelCamp = asyncHandler(async (req, res) => transitionCamp(req, res, 'cancelled', 'cancel'));
export const executeCamp = asyncHandler(async (req, res) => transitionCamp(req, res, 'executed', 'execute'));

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
  approve: { nextStatus: 'approved', from: ['pending_review'], action: 'bulk_approve', permissions: ['camps:approve', 'camps:review'] },
  reject: { nextStatus: 'rejected', from: ['pending_review'], action: 'bulk_reject', permissions: ['camps:approve'] },
  execute: { nextStatus: 'executed', from: ['approved'], action: 'bulk_execute', permissions: ['camps:execute'] },
  delete: { action: 'bulk_delete', permissions: ['camps:update', 'camps:approve'] },
};

function userCanPerformCampAction(user, permissions = []) {
  return userHasCampPermission(user, permissions);
}

function canBulkTransition(camp, nextStatus) {
  return canTransition(camp.status, nextStatus);
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

  if (!userCanPerformCampAction(req.user, config.permissions)) {
    return res.status(403).json({ message: 'Insufficient permissions for this bulk action' });
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
        throw new Error(`Camp ${camp.campId} is ${camp.status} and cannot be ${action}d`);
      }

      if (!canBulkTransition(camp, config.nextStatus)) {
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
