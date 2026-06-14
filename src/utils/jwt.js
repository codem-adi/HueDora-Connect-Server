import jwt from 'jsonwebtoken';

function getJwtSecret(name) {
  const value = process.env[name];
  if (value) return value;

  if (process.env.NODE_ENV !== 'production') {
    return `dev-${name}`;
  }

  throw new Error(`${name} is not configured`);
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user._id, role: user.role, email: user.email },
    getJwtSecret('JWT_ACCESS_SECRET'),
    { expiresIn: process.env.JWT_ACCESS_EXPIRES || '15m' }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    { sub: user._id },
    getJwtSecret('JWT_REFRESH_SECRET'),
    { expiresIn: process.env.JWT_REFRESH_EXPIRES || '7d' }
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, getJwtSecret('JWT_ACCESS_SECRET'));
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, getJwtSecret('JWT_REFRESH_SECRET'));
}
