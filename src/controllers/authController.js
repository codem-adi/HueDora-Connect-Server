import User from '../models/User.js';
import { ROLES } from '../config/constants.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { logAudit } from '../services/auditService.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { getEffectiveSignupStatus } from '../utils/userVisibility.js';
import { validateSignupPayload } from '../utils/userValidation.js';
import {
  requestPasswordResetOtp,
  resetPasswordWithOtp,
} from '../services/passwordResetService.js';

function loginBlockedMessage(user) {
  const signupStatus = getEffectiveSignupStatus(user);
  if (signupStatus === 'pending') {
    return 'Your account is pending admin approval';
  }
  if (signupStatus === 'rejected') {
    return 'Your signup request was rejected';
  }
  if (!user.isActive) {
    return 'Account is inactive';
  }
  return null;
}

export const signup = asyncHandler(async (req, res) => {
  const validation = validateSignupPayload(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ message: 'Validation failed', errors: validation.errors });
  }

  const { name, email, password, phone } = validation.value;
  const existing = await User.findOne({ email, deletedAt: null });
  if (existing) {
    return res.status(409).json({
      message: 'Email is already registered',
      errors: { email: 'Email is already registered' },
    });
  }

  const user = await User.create({
    name,
    email,
    password,
    phone,
    role: ROLES.READ_ONLY,
    signupStatus: 'pending',
    isActive: false,
  });

  res.status(201).json({
    message: 'Signup submitted. An admin will review your request.',
    user: user.toSafeObject(),
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null });

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const blockedMessage = loginBlockedMessage(user);
  if (blockedMessage) {
    return res.status(403).json({ message: blockedMessage });
  }

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);
  user.refreshToken = refreshToken;
  await user.save();

  await logAudit({
    user,
    ip: req.ip,
    entityType: 'user',
    entityId: user._id,
    action: 'login',
    afterValue: { email: user.email },
  });

  res.json({
    accessToken,
    refreshToken,
    user: user.toSafeObject(),
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ message: 'Refresh token required' });
  }

  const payload = verifyRefreshToken(refreshToken);
  const user = await User.findOne({ _id: payload.sub, refreshToken, deletedAt: null });

  if (!user) {
    return res.status(401).json({ message: 'Invalid refresh token' });
  }

  const blockedMessage = loginBlockedMessage(user);
  if (blockedMessage) {
    return res.status(403).json({ message: blockedMessage });
  }

  const accessToken = signAccessToken(user);
  res.json({ accessToken, user: user.toSafeObject() });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: req.user.toSafeObject() });
});

export const logout = asyncHandler(async (req, res) => {
  req.user.refreshToken = null;
  await req.user.save();

  await logAudit({
    user: req.user,
    ip: req.ip,
    entityType: 'user',
    entityId: req.user._id,
    action: 'logout',
  });

  res.json({ message: 'Logged out successfully' });
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const result = await requestPasswordResetOtp(req.body.email);
  if (!result.ok) {
    return res.status(result.status).json({
      message: result.message,
      errors: result.errors,
    });
  }

  res.json({
    message: result.message,
    expiresInMinutes: result.expiresInMinutes,
  });
});

export const resetPassword = asyncHandler(async (req, res) => {
  const result = await resetPasswordWithOtp(req.body);
  if (!result.ok) {
    return res.status(result.status).json({
      message: result.message,
      errors: result.errors,
    });
  }

  res.json({ message: result.message });
});
