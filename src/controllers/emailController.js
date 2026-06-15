import { asyncHandler } from '../middleware/errorHandler.js';
import { parseRawEmail } from '../services/emailClient.js';
import { pollImapInbox } from '../services/emailIngestService.js';
import { ingestWebhookEmailToInbox } from '../services/inboundEmailService.js';
import { EMAIL_FORMAT_EXAMPLE } from '../utils/emailParser.js';

function verifyEmailWebhookSecret(req) {
  const secret = process.env.EMAIL_WEBHOOK_SECRET;
  if (!secret) return true;

  const headerSecret = req.get('X-Email-Ingest-Secret');
  const authHeader = req.get('Authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  return headerSecret === secret || bearer === secret;
}

function normalizeWebhookPayload(body) {
  if (!body || typeof body !== 'object') return null;

  if (body.from && (body.text || body.html || body.attachments)) {
    return {
      from: body.from,
      subject: body.subject || '',
      messageId: body.messageId || body.message_id || `${Date.now()}`,
      text: body.text || '',
      html: body.html || '',
      receivedAt: body.receivedAt || body.date || new Date(),
      attachments: (body.attachments || []).map((attachment) => ({
        filename: attachment.filename || attachment.name || 'attachment.xlsx',
        contentType: attachment.contentType || attachment.type || '',
        content: Buffer.isBuffer(attachment.content)
          ? attachment.content
          : Buffer.from(attachment.contentBase64 || attachment.content || '', 'base64'),
      })),
    };
  }

  return null;
}

export const receiveEmailWebhook = asyncHandler(async (req, res) => {
  if (!verifyEmailWebhookSecret(req)) {
    return res.status(401).json({ message: 'Invalid email webhook secret' });
  }

  let emailPayload = normalizeWebhookPayload(req.body);

  if (!emailPayload && req.rawBody) {
    const parsed = await parseRawEmail(req.rawBody);
    emailPayload = parsed;
  }

  if (!emailPayload?.from) {
    return res.status(400).json({ message: 'Unable to parse inbound email payload' });
  }

  res.status(202).json({ message: 'Email accepted for inbox sync' });

  try {
    const stored = await ingestWebhookEmailToInbox(emailPayload);
    console.log('[email] Webhook stored in communications inbox:', stored.messageId, stored.isCampaignCandidate);
  } catch (error) {
    console.error('[email] Webhook inbox sync failed:', error);
  }
});

export const pollEmailInbox = asyncHandler(async (req, res) => {
  if (!verifyEmailWebhookSecret(req)) {
    return res.status(401).json({ message: 'Invalid email poll secret' });
  }

  const result = await pollImapInbox();
  res.json({ data: result });
});

export const getEmailFormat = (req, res) => {
  res.json({
    data: {
      bodyFormat: 'key-value lines; separate multiple camps with ---',
      excelAttachment: 'Standard camp import .xlsx (see Import sample)',
      example: EMAIL_FORMAT_EXAMPLE,
      requiredFields: ['Client', 'Date'],
      dateFormat: 'dd/mm/yyyy',
      helpSubject: 'HELP',
      webhookPath: '/api/ingest/email/webhook',
      pollPath: '/api/ingest/email/poll',
      webhookSecretHeader: 'X-Email-Ingest-Secret',
    },
  });
};
