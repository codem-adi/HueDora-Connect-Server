import User from '../models/User.js';
import { ROLES } from '../config/constants.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { logAudit } from '../services/auditService.js';
import { buildPaginationMeta, parsePaginationQuery } from '../utils/pagination.js';
import { escapeRegex } from '../utils/trimInput.js';
import {
  buildManagedUserFilter,
  getEffectiveSignupStatus,
  isManagedUser,
} from '../utils/userVisibility.js';
import { validateAdminUserPayload } from '../utils/userValidation.js';

function toPublicUser(user) {
  return user.toSafeObject();
}

async function findManagedUserById(id) {
  const user = await User.findOne({ _id: id, ...buildManagedUserFilter() });
  return user;
}

export const listUsers = asyncHandler(async (req, res) => {
  const { page, limit, skip } = parsePaginationQuery(req.query);
  const search = String(req.query.search || '').trim();
  const status = String(req.query.status || 'all').trim().toLowerCase();

  const filter = buildManagedUserFilter();

  if (search) {
    const regex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [{ name: regex }, { email: regex }, { phone: regex }];
  }

  if (status === 'pending') {
    filter.signupStatus = 'pending';
  } else if (status === 'rejected') {
    filter.signupStatus = 'rejected';
  } else if (status === 'active') {
    filter.$and = [
      { $or: [{ signupStatus: 'approved' }, { signupStatus: { $exists: false } }] },
      { isActive: true },
    ];
  } else if (status === 'inactive') {
    filter.$and = [
      { $or: [{ signupStatus: 'approved' }, { signupStatus: { $exists: false } }] },
      { isActive: false },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  res.json({
    data: users.map(toPublicUser),
    pagination: buildPaginationMeta(page, limit, total),
  });
});

export const getUser = asyncHandler(async (req, res) => {
  const user = await findManagedUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json({ data: toPublicUser(user) });
});

export const createUser = asyncHandler(async (req, res) => {
  const validation = validateAdminUserPayload(req.body, { requirePassword: true });
  if (!validation.isValid) {
    return res.status(400).json({ message: 'Validation failed', errors: validation.errors });
  }

  const { name, email, password, role, phone } = validation.value;
  const existing = await User.findOne({ email, deletedAt: null });
  if (existing) {
    return res.status(409).json({ message: 'Email is already registered', errors: { email: 'Email is already registered' } });
  }

  const user = await User.create({
    name,
    email,
    password,
    role,
    phone,
    signupStatus: 'approved',
    isActive: true,
  });

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'user',
    entityId: user._id,
    action: 'create',
    afterValue: toPublicUser(user),
  });

  res.status(201).json({ data: toPublicUser(user) });
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await findManagedUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const validation = validateAdminUserPayload(req.body, { isUpdate: true });
  if (!validation.isValid) {
    return res.status(400).json({ message: 'Validation failed', errors: validation.errors });
  }

  const { name, email, password, role, phone } = validation.value;
  const beforeValue = toPublicUser(user);

  if (email && email !== user.email) {
    const existing = await User.findOne({ email, deletedAt: null, _id: { $ne: user._id } });
    if (existing) {
      return res.status(409).json({ message: 'Email is already registered', errors: { email: 'Email is already registered' } });
    }
    user.email = email;
  }

  if (name) user.name = name;
  if (role) user.role = role;
  if (phone !== undefined) user.phone = phone;
  if (password) user.password = password;

  await user.save();

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'user',
    entityId: user._id,
    action: 'update',
    beforeValue,
    afterValue: toPublicUser(user),
  });

  res.json({ data: toPublicUser(user) });
});

async function updateUserStatus(req, res, { signupStatus, isActive, action }) {
  const user = await findManagedUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  const beforeValue = toPublicUser(user);

  if (signupStatus !== undefined) user.signupStatus = signupStatus;
  if (isActive !== undefined) user.isActive = isActive;

  await user.save();

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'user',
    entityId: user._id,
    action,
    beforeValue,
    afterValue: toPublicUser(user),
  });

  res.json({ data: toPublicUser(user) });
}

export const approveUser = asyncHandler(async (req, res) => {
  const user = await findManagedUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (getEffectiveSignupStatus(user) !== 'pending') {
    return res.status(400).json({ message: 'Only pending signups can be approved' });
  }

  const role = String(req.body.role || user.role || ROLES.READ_ONLY).trim();
  const validation = validateAdminUserPayload({ ...req.body, role }, { isUpdate: true });
  if (!validation.isValid) {
    return res.status(400).json({ message: 'Validation failed', errors: validation.errors });
  }

  const beforeValue = toPublicUser(user);
  user.signupStatus = 'approved';
  user.isActive = true;
  user.role = validation.value.role || user.role;

  await user.save();

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'user',
    entityId: user._id,
    action: 'approve_signup',
    beforeValue,
    afterValue: toPublicUser(user),
  });

  res.json({ data: toPublicUser(user) });
});

export const rejectUser = asyncHandler(async (req, res) => {
  const user = await findManagedUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (getEffectiveSignupStatus(user) !== 'pending') {
    return res.status(400).json({ message: 'Only pending signups can be rejected' });
  }

  await updateUserStatus(req, res, {
    signupStatus: 'rejected',
    isActive: false,
    action: 'reject_signup',
  });
});

export const activateUser = asyncHandler(async (req, res) => {
  const user = await findManagedUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (getEffectiveSignupStatus(user) !== 'approved') {
    return res.status(400).json({ message: 'Only approved users can be activated' });
  }

  await updateUserStatus(req, res, {
    isActive: true,
    action: 'activate_user',
  });
});

export const deactivateUser = asyncHandler(async (req, res) => {
  const user = await findManagedUserById(req.params.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (req.user._id.equals(user._id)) {
    return res.status(400).json({ message: 'You cannot deactivate your own account' });
  }

  await updateUserStatus(req, res, {
    isActive: false,
    action: 'deactivate_user',
  });
});

export const getRolePermissions = asyncHandler(async (req, res) => {
  const { ROLE_PERMISSIONS } = await import('../config/constants.js');
  const roles = Object.entries(ROLE_PERMISSIONS)
    .filter(([role]) => role !== ROLES.SUPER_ADMIN)
    .map(([role, permissions]) => ({ role, permissions }));

  res.json({ data: roles });
});

export function assertManagedUserResponse(user, res) {
  if (!isManagedUser(user)) {
    res.status(404).json({ message: 'User not found' });
    return false;
  }
  return true;
}
