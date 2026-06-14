import User from '../models/User.js';
import { ROLE_PERMISSIONS } from '../config/constants.js';
import { verifyAccessToken } from '../utils/jwt.js';
import { asyncHandler } from './errorHandler.js';

export const authenticate = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required' });
  }

  const payload = verifyAccessToken(token);
  const user = await User.findOne({ _id: payload.sub, deletedAt: null, isActive: true });

  if (!user) {
    return res.status(401).json({ message: 'User not found or inactive' });
  }

  req.user = user;
  next();
});

export function authorize(...permissions) {
  return (req, res, next) => {
    const rolePerms = ROLE_PERMISSIONS[req.user.role] || [];

    if (rolePerms.includes('*')) {
      return next();
    }

    const allowed = permissions.some((perm) => rolePerms.includes(perm));

    if (!allowed) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
}

export function requireSuperAdmin(req, res, next) {
  if (req.user.role !== 'super_admin') {
    return res.status(403).json({ message: 'Super admin access required' });
  }
  next();
}
