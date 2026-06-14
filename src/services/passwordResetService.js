import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import PasswordResetOtp from '../models/PasswordResetOtp.js';
import { sendTransactionalEmail, isEmailReplyConfigured } from '../services/emailClient.js';
import { buildPasswordResetOtpEmail, getOtpExpiryMinutes } from '../utils/otpEmailTemplate.js';
import { isSystemUser, isSuperAdminUser } from '../utils/userVisibility.js';
import { validateEmail, validatePassword } from '../utils/userValidation.js';

const GENERIC_RESET_MESSAGE = 'If an account exists for this email, a reset code has been sent.';

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function getExpiryDate() {
  const minutes = getOtpExpiryMinutes();
  return new Date(Date.now() + minutes * 60 * 1000);
}

async function findResetEligibleUser(email) {
  const user = await User.findOne({ email, deletedAt: null });
  if (!user || isSuperAdminUser(user) || isSystemUser(user)) {
    return null;
  }
  return user;
}

export async function requestPasswordResetOtp(emailInput) {
  const errors = {};
  const email = validateEmail(emailInput, errors);
  if (Object.keys(errors).length) {
    return { ok: false, status: 400, message: 'Validation failed', errors };
  }

  if (!isEmailReplyConfigured()) {
    return {
      ok: false,
      status: 503,
      message: 'Password reset email is not configured. Contact your administrator.',
    };
  }

  const user = await findResetEligibleUser(email);
  if (!user) {
    return {
      ok: true,
      status: 200,
      message: GENERIC_RESET_MESSAGE,
      expiresInMinutes: getOtpExpiryMinutes(),
    };
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = getExpiryDate();

  await PasswordResetOtp.deleteMany({ email, usedAt: null });
  await PasswordResetOtp.create({
    email,
    otpHash,
    expiresAt,
  });

  const template = buildPasswordResetOtpEmail({
    name: user.name,
    otp,
    expiryMinutes: getOtpExpiryMinutes(),
  });

  const sent = await sendTransactionalEmail({
    to: email,
    subject: template.subject,
    text: template.text,
    html: template.html,
  });

  if (!sent) {
    await PasswordResetOtp.deleteMany({ email, usedAt: null });
    return {
      ok: false,
      status: 503,
      message: 'Unable to send reset email right now. Please try again later.',
    };
  }

  return {
    ok: true,
    status: 200,
    message: GENERIC_RESET_MESSAGE,
    expiresInMinutes: getOtpExpiryMinutes(),
  };
}

export async function resetPasswordWithOtp({ email: emailInput, otp, password, confirmPassword }) {
  const errors = {};
  const email = validateEmail(emailInput, errors, 'email');
  const nextPassword = validatePassword(password, errors, 'password');
  const confirm = String(confirmPassword || '');

  if (!otp) {
    errors.otp = 'OTP is required';
  } else if (!/^\d{6}$/.test(String(otp).trim())) {
    errors.otp = 'Enter the 6-digit OTP from your email';
  }

  if (nextPassword && confirm && nextPassword !== confirm) {
    errors.confirmPassword = 'Passwords do not match';
  } else if (!confirm) {
    errors.confirmPassword = 'Please confirm your password';
  }

  if (Object.keys(errors).length) {
    return { ok: false, status: 400, message: 'Validation failed', errors };
  }

  const user = await findResetEligibleUser(email);
  if (!user) {
    return { ok: false, status: 400, message: 'Invalid or expired reset code', errors: { otp: 'Invalid or expired reset code' } };
  }

  const record = await PasswordResetOtp.findOne({
    email,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });

  if (!record) {
    return { ok: false, status: 400, message: 'Invalid or expired reset code', errors: { otp: 'Invalid or expired reset code' } };
  }

  if (record.attempts >= record.maxAttempts) {
    return { ok: false, status: 429, message: 'Too many invalid attempts. Request a new code.', errors: { otp: 'Too many invalid attempts. Request a new code.' } };
  }

  const otpValid = await bcrypt.compare(String(otp).trim(), record.otpHash);
  if (!otpValid) {
    record.attempts += 1;
    await record.save();
    return { ok: false, status: 400, message: 'Invalid or expired reset code', errors: { otp: 'Invalid or expired reset code' } };
  }

  user.password = nextPassword;
  user.refreshToken = null;
  await user.save();

  record.usedAt = new Date();
  await record.save();
  await PasswordResetOtp.deleteMany({ email, usedAt: null, _id: { $ne: record._id } });

  return {
    ok: true,
    status: 200,
    message: 'Password reset successful. You can now sign in with your new password.',
  };
}
