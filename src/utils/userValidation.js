import { ROLES } from '../config/constants.js';

export const ADMIN_ASSIGNABLE_ROLES = [
  ROLES.ADMIN,
  ROLES.OPERATIONS_EXECUTIVE,
  ROLES.REVIEWER,
  ROLES.READ_ONLY,
];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function addError(errors, field, message) {
  if (!errors[field]) errors[field] = message;
}

export function validateName(name, errors, field = 'name') {
  const value = String(name || '').trim();
  if (!value) {
    addError(errors, field, 'Name is required');
    return '';
  }
  if (value.length < 2) {
    addError(errors, field, 'Name must be at least 2 characters');
  }
  if (value.length > 100) {
    addError(errors, field, 'Name must be 100 characters or less');
  }
  return value;
}

export function validateEmail(email, errors, field = 'email') {
  const value = String(email || '').trim().toLowerCase();
  if (!value) {
    addError(errors, field, 'Email is required');
    return '';
  }
  if (!EMAIL_PATTERN.test(value)) {
    addError(errors, field, 'Enter a valid email address');
  }
  return value;
}

export function validatePassword(password, errors, field = 'password') {
  const value = String(password || '');
  if (!value) {
    addError(errors, field, 'Password is required');
    return '';
  }
  if (value.length < 6) {
    addError(errors, field, 'Password must be at least 6 characters');
  }
  if (value.length > 128) {
    addError(errors, field, 'Password must be 128 characters or less');
  }
  return value;
}

export function validateSignupPayload(body = {}) {
  const errors = {};
  const name = validateName(body.name, errors);
  const email = validateEmail(body.email, errors);
  const password = validatePassword(body.password, errors);
  const confirmPassword = String(body.confirmPassword || '');

  if (password && confirmPassword && password !== confirmPassword) {
    addError(errors, 'confirmPassword', 'Passwords do not match');
  } else if (!confirmPassword) {
    addError(errors, 'confirmPassword', 'Please confirm your password');
  }

  const phone = String(body.phone || '').trim();
  if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) {
    addError(errors, 'phone', 'Enter a valid phone number');
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    value: { name, email, password, phone: phone || undefined },
  };
}

export function validateAdminUserPayload(body = {}, { requirePassword = false, isUpdate = false } = {}) {
  const errors = {};
  const name = validateName(body.name, errors);
  const email = validateEmail(body.email, errors);

  let password = '';
  if (requirePassword || body.password) {
    password = validatePassword(body.password, errors);
    if (!requirePassword && !body.password) {
      delete errors.password;
      password = '';
    }
  }

  const role = String(body.role || '').trim();
  if (!isUpdate || body.role !== undefined) {
    if (!role) {
      addError(errors, 'role', 'Role is required');
    } else if (!ADMIN_ASSIGNABLE_ROLES.includes(role)) {
      addError(errors, 'role', 'Invalid role selected');
    }
  }

  const phone = String(body.phone || '').trim();
  if (phone && !/^[0-9+\-\s()]{7,20}$/.test(phone)) {
    addError(errors, 'phone', 'Enter a valid phone number');
  }

  return {
    errors,
    isValid: Object.keys(errors).length === 0,
    value: {
      name,
      email,
      password: password || undefined,
      role: role || undefined,
      phone: phone || undefined,
      isActive: body.isActive,
      signupStatus: body.signupStatus,
    },
  };
}
