const APP_NAME = process.env.APP_NAME || 'HueDora Connect';
const OTP_EXPIRY_MINUTES = Number(process.env.PASSWORD_RESET_OTP_EXPIRY_MINUTES || 10);

export function getOtpExpiryMinutes() {
  return OTP_EXPIRY_MINUTES;
}

export function buildPasswordResetOtpEmail({ name, otp, expiryMinutes = OTP_EXPIRY_MINUTES }) {
  const greetingName = name?.trim() || 'there';
  const subject = `${APP_NAME} — Password reset code`;

  const text = [
    `${APP_NAME}`,
    '',
    `Hi ${greetingName},`,
    '',
    'We received a request to reset your password.',
    '',
    `Your one-time password (OTP) is: ${otp}`,
    '',
    `This code expires in ${expiryMinutes} minutes.`,
    '',
    'If you did not request a password reset, you can safely ignore this email.',
    '',
    `— ${APP_NAME} Team`,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f4f7f6;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #d9e4e1;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="background:linear-gradient(135deg,#0f766e,#134e4a);padding:24px 28px;color:#ffffff;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;opacity:0.85;">${APP_NAME}</div>
              <h1 style="margin:8px 0 0;font-size:24px;line-height:1.3;font-weight:700;">Password Reset Code</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">Hi ${escapeHtml(greetingName)},</p>
              <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155;">
                Use the one-time password below to reset your account password.
              </p>
              <div style="margin:0 0 20px;padding:18px 20px;border-radius:12px;background:#f0fdfa;border:1px solid #99f6e4;text-align:center;">
                <div style="font-size:12px;letter-spacing:0.12em;text-transform:uppercase;color:#0f766e;font-weight:700;">Your OTP</div>
                <div style="margin-top:10px;font-size:32px;line-height:1;letter-spacing:0.35em;font-weight:700;color:#134e4a;">${otp}</div>
              </div>
              <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#64748b;">
                This code expires in <strong>${expiryMinutes} minutes</strong>.
              </p>
              <p style="margin:0;font-size:14px;line-height:1.6;color:#64748b;">
                If you did not request this, you can ignore this email. Your password will remain unchanged.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;line-height:1.5;color:#94a3b8;">
              Automated message from ${APP_NAME}. Please do not reply to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
