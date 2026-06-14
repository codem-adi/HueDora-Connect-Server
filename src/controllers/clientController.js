import Client from '../models/Client.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAudit } from '../services/auditService.js';
import { escapeRegex } from '../utils/trimInput.js';
import { buildPaginationMeta, parsePaginationQuery } from '../utils/pagination.js';

const PROTECTED_CLIENT_CODES = new Set(['EMAIL-PENDING']);

function buildClientCode(name) {
  const base = String(name || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 12);
  return base || 'CLIENT';
}

async function ensureUniqueCode(baseCode) {
  let code = baseCode;
  let suffix = 1;
  while (await Client.findOne({ deletedAt: null, code })) {
    code = `${baseCode}${suffix}`;
    suffix += 1;
  }
  return code;
}

export async function resolveClient({ clientId, clientName, clientCode, allowCreate = true }) {
  if (clientId) {
    const byId = await Client.findOne({ _id: clientId, deletedAt: null });
    if (byId) return byId;
  }

  const name = String(clientName || '').trim();
  if (!name) return null;

  const existing = await Client.findOne({ deletedAt: null, name });
  if (existing) return existing;

  if (!allowCreate) {
    return null;
  }

  const requestedCode = String(clientCode || '').trim().toUpperCase();
  const code = requestedCode || await ensureUniqueCode(buildClientCode(name));
  if (await Client.findOne({ deletedAt: null, code })) {
    return null;
  }

  return Client.create({ name, code, isActive: true });
}

export async function resolveExistingClient({ clientId, clientName }) {
  return resolveClient({ clientId, clientName, allowCreate: false });
}

export const listClients = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const search = String(req.query.search || '').trim();

  const filter = { deletedAt: null };
  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { code: regex }];
  }

  const [clients, total] = await Promise.all([
    Client.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
    Client.countDocuments(filter),
  ]);

  res.json({
    data: clients,
    pagination: buildPaginationMeta(page, limit, total),
  });
});

export const getClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, deletedAt: null });
  if (!client) {
    return res.status(404).json({ message: 'Client not found' });
  }
  res.json({ data: client });
});

export const createClient = asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const code = String(req.body.code || '').trim().toUpperCase() || await ensureUniqueCode(buildClientCode(name));

  if (!name) {
    return res.status(400).json({ message: 'Client name is required' });
  }

  const existing = await Client.findOne({
    deletedAt: null,
    $or: [{ name }, { code }],
  });
  if (existing) {
    return res.status(409).json({ message: 'Client with this name or code already exists' });
  }

  const client = await Client.create({ name, code, isActive: req.body.isActive !== false });

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'client',
    entityId: client._id,
    action: 'create',
    afterValue: client.toObject(),
  });

  res.status(201).json({ data: client });
});

export const updateClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, deletedAt: null });
  if (!client) {
    return res.status(404).json({ message: 'Client not found' });
  }

  if (PROTECTED_CLIENT_CODES.has(client.code)) {
    return res.status(400).json({ message: 'This system client cannot be edited' });
  }

  const before = client.toObject();
  const name = req.body.name !== undefined ? String(req.body.name || '').trim() : client.name;
  const code = req.body.code !== undefined
    ? String(req.body.code || '').trim().toUpperCase()
    : client.code;

  if (!name || !code) {
    return res.status(400).json({ message: 'Client name and code are required' });
  }

  const duplicate = await Client.findOne({
    deletedAt: null,
    _id: { $ne: client._id },
    $or: [{ name }, { code }],
  });
  if (duplicate) {
    return res.status(409).json({ message: 'Another client already uses this name or code' });
  }

  client.name = name;
  client.code = code;
  if (req.body.isActive !== undefined) client.isActive = req.body.isActive !== false;
  await client.save();

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'client',
    entityId: client._id,
    action: 'update',
    beforeValue: before,
    afterValue: client.toObject(),
  });

  res.json({ data: client });
});

export const softDeleteClient = asyncHandler(async (req, res) => {
  const client = await Client.findOne({ _id: req.params.id, deletedAt: null });
  if (!client) {
    return res.status(404).json({ message: 'Client not found' });
  }

  if (PROTECTED_CLIENT_CODES.has(client.code)) {
    return res.status(400).json({ message: 'This system client cannot be deleted' });
  }

  const before = client.toObject();
  client.deletedAt = new Date();
  client.isActive = false;
  await client.save();

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'client',
    entityId: client._id,
    action: 'soft_delete',
    beforeValue: before,
    afterValue: client.toObject(),
  });

  res.json({ message: 'Client archived successfully' });
});
