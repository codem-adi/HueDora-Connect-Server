import { trimDeep } from '../utils/trimInput.js';

export function trimRequest(req, res, next) {
  if (req.query) req.query = trimDeep(req.query);
  if (req.body && typeof req.body === 'object') req.body = trimDeep(req.body);
  next();
}
