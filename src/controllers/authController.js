import User from '../models/User.js';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../utils/jwt.js';
import { logAudit } from '../services/auditService.js';
import { asyncHandler } from '../middleware/errorHandler.js';

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null });

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  if (!user.isActive) {
    return res.status(403).json({ message: 'Account is inactive' });
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

  if (!user || !user.isActive) {
    return res.status(401).json({ message: 'Invalid refresh token' });
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
