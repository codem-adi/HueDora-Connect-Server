import fs from 'fs';
import Client from '../models/Client.js';
import ClientMaster from '../models/ClientMaster.js';
import { ROLE_PERMISSIONS } from '../config/constants.js';
import { resolveClient } from '../controllers/clientController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAudit } from '../services/auditService.js';
import { escapeRegex } from '../utils/trimInput.js';
import { validateClientMasterPayload } from '../utils/clientMasterValidation.js';
import { buildPaginationMeta, parsePaginationQuery } from '../utils/pagination.js';
import {
  deleteProgramDocumentFile,
  resolveStoredFilePath,
} from '../utils/programDocumentStorage.js';
import { programDocumentFromUploadedFile } from '../middleware/uploadProgramPdf.js';

const NUMERIC_FIELDS = [
  'poAmount',
  'executedCampUnit',
  'cancelledCampUnit',
  'otUnit',
  'minimumPatientCovered',
  'minimumKmsCovered',
  'extPatientUnit',
  'kmsUnit',
];

const STRING_FIELDS = [
  'programName',
  'drugTherapyName',
  'campName',
  'campType',
  'coordinatorName',
  'healthcareWorker',
  'campDuration',
  'spocName',
  'spocNumber',
  'requestTimeline',
];

function parseNumeric(value, fallback = 0) {
  if (value === '' || value == null) return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function buildPayload(body, client) {
  const payload = {
    client: client._id,
    clientName: client.name,
    isActive: body.isActive !== false,
  };

  STRING_FIELDS.forEach((field) => {
    if (body[field] !== undefined) {
      payload[field] = String(body[field] || '').trim();
    }
  });

  NUMERIC_FIELDS.forEach((field) => {
    if (body[field] !== undefined) {
      payload[field] = parseNumeric(body[field]);
    }
  });

  return payload;
}

function hasProgramDocument(record) {
  return Boolean(record?.programDocument?.storedName);
}

async function removeProgramDocument(record) {
  if (!hasProgramDocument(record)) return;
  await deleteProgramDocumentFile(record.programDocument.storedName);
  record.programDocument = {
    fileName: '',
    storedName: '',
    mimeType: '',
    fileSize: 0,
    uploadedAt: null,
    uploadedBy: null,
  };
}

function userCanCreateClients(user) {
  const permissions = ROLE_PERMISSIONS[user?.role] || [];
  return permissions.includes('*') || permissions.includes('clients:create');
}

async function resolveClientForMaster(body, user) {
  const allowClientCreate = userCanCreateClients(user);
  const client = await resolveClient({
    clientId: body.clientId,
    clientName: body.clientName,
    clientCode: body.clientCode,
    allowCreate: allowClientCreate,
  });

  if (!client) {
    const error = new Error(
      allowClientCreate
        ? 'Client name is required'
        : 'Company does not exist. Select an existing company from the list — new companies can only be created by an administrator.'
    );
    error.status = 400;
    throw error;
  }

  return client;
}

export const listClientMasters = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const search = String(req.query.search || '').trim();

  const filter = { deletedAt: null };
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { clientName: regex },
      { programName: regex },
      { campName: regex },
      { campType: regex },
      { spocName: regex },
      { coordinatorName: regex },
      { drugTherapyName: regex },
    ];
  }

  const [records, total] = await Promise.all([
    ClientMaster.find(filter)
      .populate('client', 'name code isActive')
      .sort({ clientName: 1, programName: 1, campName: 1 })
      .skip(skip)
      .limit(limit),
    ClientMaster.countDocuments(filter),
  ]);

  res.json({
    data: records,
    pagination: buildPaginationMeta(page, limit, total),
  });
});

export const listClientMastersByClient = asyncHandler(async (req, res) => {
  const records = await ClientMaster.find({
    deletedAt: null,
    client: req.params.clientId,
  })
    .populate('client', 'name code isActive')
    .sort({ programName: 1, campName: 1 });

  res.json({ data: records });
});

export const listDivisionsByClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.clientId, deletedAt: null });
  if (!client) {
    return res.status(404).json({ message: 'Client not found' });
  }

  const records = await ClientMaster.find({
    deletedAt: null,
    client: client._id,
    programName: { $ne: '' },
  })
    .select('programName campName isActive')
    .sort({ programName: 1, campName: 1 });

  const divisionMap = new Map();
  records.forEach((record) => {
    const division = String(record.programName || '').trim();
    if (!division) return;
    if (!divisionMap.has(division)) {
      divisionMap.set(division, { programName: division, campNames: [], isActive: false });
    }
    const entry = divisionMap.get(division);
    const campName = String(record.campName || '').trim();
    if (campName && !entry.campNames.includes(campName)) {
      entry.campNames.push(campName);
    }
    if (record.isActive) entry.isActive = true;
  });

  res.json({
    data: [...divisionMap.values()],
    divisions: [...divisionMap.keys()],
  });
});

export const getClientMaster = asyncHandler(async (req, res) => {
  const record = await ClientMaster.findOne({ _id: req.params.id, deletedAt: null })
    .populate('client', 'name code isActive');
  if (!record) {
    return res.status(404).json({ message: 'Client master record not found' });
  }
  res.json({ data: record });
});

export const createClientMaster = asyncHandler(async (req, res) => {
  const validationErrors = validateClientMasterPayload(req.body);
  if (validationErrors.length) {
    return res.status(400).json({ message: validationErrors[0], errors: validationErrors });
  }

  const client = await resolveClientForMaster(req.body, req.user);
  const payload = buildPayload(req.body, client);
  const record = await ClientMaster.create({
    ...payload,
    createdBy: req.user._id,
    updatedBy: req.user._id,
  });

  await record.populate('client', 'name code isActive');

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'client_master',
    entityId: record._id,
    action: 'create',
    afterValue: record.toObject(),
  });

  res.status(201).json({ data: record });
});

export const updateClientMaster = asyncHandler(async (req, res) => {
  const validationErrors = validateClientMasterPayload(req.body);
  if (validationErrors.length) {
    return res.status(400).json({ message: validationErrors[0], errors: validationErrors });
  }

  const record = await ClientMaster.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) {
    return res.status(404).json({ message: 'Client master record not found' });
  }

  const before = record.toObject();
  let client = await resolveClient({
    clientId: record.client,
    clientName: record.clientName,
    allowCreate: false,
  });

  if (req.body.clientId !== undefined || req.body.clientName !== undefined || req.body.clientCode !== undefined) {
    client = await resolveClientForMaster(req.body, req.user);
    record.client = client._id;
    record.clientName = client.name;
  }

  const payload = buildPayload(req.body, client);
  STRING_FIELDS.forEach((field) => {
    if (payload[field] !== undefined) record[field] = payload[field];
  });
  NUMERIC_FIELDS.forEach((field) => {
    if (payload[field] !== undefined) record[field] = payload[field];
  });
  if (req.body.isActive !== undefined) record.isActive = req.body.isActive !== false;
  record.updatedBy = req.user._id;

  await record.save();
  await record.populate('client', 'name code isActive');

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'client_master',
    entityId: record._id,
    action: 'update',
    beforeValue: before,
    afterValue: record.toObject(),
  });

  res.json({ data: record });
});

export const softDeleteClientMaster = asyncHandler(async (req, res) => {
  const record = await ClientMaster.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) {
    return res.status(404).json({ message: 'Client master record not found' });
  }

  const before = record.toObject();
  record.deletedAt = new Date();
  record.updatedBy = req.user._id;
  await removeProgramDocument(record);
  await record.save();

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'client_master',
    entityId: record._id,
    action: 'soft_delete',
    beforeValue: before,
    afterValue: record.toObject(),
  });

  res.json({ message: 'Client master record archived successfully' });
});

export const uploadProgramDocument = asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'PDF document is required' });
  }

  const record = await ClientMaster.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) {
    return res.status(404).json({ message: 'Client master record not found' });
  }

  const before = record.toObject();
  if (hasProgramDocument(record)) {
    await deleteProgramDocumentFile(record.programDocument.storedName);
  }

  const saved = programDocumentFromUploadedFile(req.file);
  record.programDocument = {
    ...saved,
    uploadedAt: new Date(),
    uploadedBy: req.user._id,
  };
  record.updatedBy = req.user._id;
  await record.save();
  await record.populate('client', 'name code isActive');

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'client_master',
    entityId: record._id,
    action: 'upload_document',
    beforeValue: before,
    afterValue: record.toObject(),
  });

  res.json({ data: record, message: 'Program document uploaded successfully' });
});

export const deleteProgramDocument = asyncHandler(async (req, res) => {
  const record = await ClientMaster.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) {
    return res.status(404).json({ message: 'Client master record not found' });
  }

  if (!hasProgramDocument(record)) {
    return res.status(404).json({ message: 'No program document to delete' });
  }

  const before = record.toObject();
  await removeProgramDocument(record);
  record.updatedBy = req.user._id;
  await record.save();
  await record.populate('client', 'name code isActive');

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'client_master',
    entityId: record._id,
    action: 'delete_document',
    beforeValue: before,
    afterValue: record.toObject(),
  });

  res.json({ data: record, message: 'Program document deleted successfully' });
});

export const getProgramDocument = asyncHandler(async (req, res) => {
  const record = await ClientMaster.findOne({ _id: req.params.id, deletedAt: null });
  if (!record) {
    return res.status(404).json({ message: 'Client master record not found' });
  }

  if (!hasProgramDocument(record)) {
    return res.status(404).json({ message: 'This program does not have a PDF document.' });
  }

  const filePath = resolveStoredFilePath(record.programDocument.storedName);
  if (!fs.existsSync(filePath)) {
    const before = record.toObject();
    await removeProgramDocument(record);
    record.updatedBy = req.user._id;
    await record.save();
    await record.populate('client', 'name code isActive');

    await logAudit({
      user: req.user,
      ip: req.ip,
      entityType: 'client_master',
      entityId: record._id,
      action: 'document_missing',
      beforeValue: before,
      afterValue: record.toObject(),
    });

    return res.status(404).json({
      message: 'Program PDF is missing. The program has been updated to show no document.',
      documentCleared: true,
      data: record,
    });
  }

  res.setHeader('Content-Type', record.programDocument.mimeType || 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${encodeURIComponent(record.programDocument.fileName || 'program-document.pdf')}"`,
  );
  fs.createReadStream(filePath).pipe(res);
});
