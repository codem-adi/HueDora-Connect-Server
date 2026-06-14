import { isValidCampName } from '../config/campNames.js';

const DURATION_PATTERN = /^(\d{1,2}):([0-5]\d)$/;

export function validateClientMasterPayload(body) {
  const errors = [];

  const clientName = String(body.clientName || '').trim();
  if (!clientName) errors.push('Client name is required');
  else if (clientName.length > 120) errors.push('Client name is too long');

  const clientCode = String(body.clientCode || '').trim();
  if (clientCode && !/^[A-Z0-9_-]{2,20}$/i.test(clientCode)) {
    errors.push('Client code must be 2–20 letters, numbers, hyphen or underscore');
  }

  const campName = String(body.campName || '').trim();
  if (campName && !isValidCampName(campName)) {
    errors.push('Camp type must be one of the configured camp types');
  }

  const campDuration = String(body.campDuration || '').trim();
  if (campDuration && !DURATION_PATTERN.test(campDuration)) {
    errors.push('Camp duration must use format like 4:00');
  }

  const spocNumber = String(body.spocNumber || '').trim();
  if (spocNumber && !/^\d{6,15}$/.test(spocNumber)) {
    errors.push('SPOC number must be 6–15 digits');
  }

  const numberFields = [
    'poAmount',
    'executedCampUnit',
    'cancelledCampUnit',
    'otUnit',
    'minimumPatientCovered',
    'minimumKmsCovered',
    'extPatientUnit',
    'kmsUnit',
  ];

  numberFields.forEach((field) => {
    if (body[field] === undefined || body[field] === '') return;
    const value = Number(body[field]);
    if (Number.isNaN(value) || value < 0) {
      errors.push(`${field} must be a non-negative number`);
    }
  });

  return errors;
}
