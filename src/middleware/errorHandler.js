export function errorHandler(err, req, res, next) {
  console.error(err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      message: 'Validation failed',
      errors: Object.values(err.errors).map((e) => e.message),
    });
  }

  if (err.code === 11000) {
    return res.status(409).json({ message: 'Duplicate record found' });
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      message: err.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
    });
  }

  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Internal server error',
  });
}

export function notFound(req, res) {
  res.status(404).json({ message: 'Route not found' });
}

export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
