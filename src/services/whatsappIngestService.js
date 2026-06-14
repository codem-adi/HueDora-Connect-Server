import Camp from '../models/Camp.js';
import Client from '../models/Client.js';
import User from '../models/User.js';
import { logAudit } from './auditService.js';
import { createCampFromRow } from './campCreationService.js';
import { sendWhatsAppText } from './whatsappClient.js';
import { ensurePendingEmailClient } from './ensureServiceUsers.js';
import {
  parseCampMessages,
  PENDING_IMPORT_CLIENT_NAME,
  matchClientFromText,
} from '../utils/campMessageParser.js';
import {
  WHATSAPP_HELP_TEXT,
} from '../utils/whatsappParser.js';
import { buildWhatsAppAutoReply } from '../utils/emailReplyTemplates.js';
import { appendIngestReviewRemarks } from '../utils/ingestReviewNotes.js';

export function normalizeWhatsAppPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function resolveCreatedByUser(senderPhone) {
  const normalized = normalizeWhatsAppPhone(senderPhone);
  if (normalized) {
    const mappedUser = await User.findOne({
      whatsappPhone: normalized,
      isActive: true,
      deletedAt: null,
    });
    if (mappedUser) return mappedUser;
  }

  const serviceEmail = process.env.WHATSAPP_SERVICE_USER_EMAIL || 'whatsapp-bot@huedoraconnect.com';
  const serviceUser = await User.findOne({ email: serviceEmail, deletedAt: null });
  if (!serviceUser) {
    throw new Error(`WhatsApp service user not found (${serviceEmail}). Run seed or set WHATSAPP_SERVICE_USER_EMAIL.`);
  }

  return serviceUser;
}

async function resolveClientForImport(row, searchText) {
  const clients = await Client.find({ deletedAt: null, isActive: true });
  const clientName = String(row.clientName || '').trim();

  if (clientName && clientName !== PENDING_IMPORT_CLIENT_NAME) {
    const exact = clients.find((client) => client.name.toLowerCase() === clientName.toLowerCase());
    if (exact) return exact;

    const partial = clients.find((client) => clientName.toLowerCase().includes(client.name.toLowerCase().split(' ')[0]));
    if (partial) return partial;
  }

  const matched = matchClientFromText(searchText, clients);
  if (matched) {
    const client = clients.find((item) => item.name.toLowerCase() === matched.toLowerCase());
    if (client) return client;
  }

  return ensurePendingEmailClient();
}

function isHelpMessage(text) {
  const normalized = String(text || '').trim().toLowerCase();
  return ['help', 'format', 'template', 'example'].includes(normalized);
}

function buildIngestId(messageId, rowNumber) {
  return `${messageId}#${rowNumber}`;
}

async function campExists(ingestId) {
  return Camp.findOne({
    $or: [{ whatsappMessageId: ingestId }, { emailIngestId: ingestId }],
  });
}

async function createCampFromWhatsAppRow({
  row,
  rowNumber,
  message,
  createdBy,
  submittedAt,
}) {
  const ingestId = buildIngestId(message.id, rowNumber);
  const existing = await campExists(ingestId);
  if (existing) {
    return { status: 'duplicate', campId: existing.campId, ingestId, rowNumber };
  }

  const client = await resolveClientForImport(row, message.text);

  const camp = await createCampFromRow({
    row: appendIngestReviewRemarks(row, client),
    client,
    createdBy,
    source: 'whatsapp',
    submittedAt,
    extras: {
      whatsappMessageId: ingestId,
      whatsappSenderPhone: normalizeWhatsAppPhone(message.from),
      whatsappRawMessage: message.text,
    },
  });

  await logAudit({
    user: createdBy,
    ip: 'whatsapp',
    entityType: 'camp',
    entityId: camp._id,
    action: 'create_whatsapp',
    afterValue: {
      campId: camp.campId,
      whatsappMessageId: ingestId,
      sender: message.from,
    },
  });

  console.log(
    `[whatsapp] Camp created | campId=${camp.campId} | from=${message.from} | row=${rowNumber}${row.partial ? ' | needsReview=true' : ''}`
  );

  return {
    status: 'created',
    campId: camp.campId,
    ingestId,
    rowNumber,
    partial: row.partial,
    campDate: camp.campDate,
    startTime: camp.startTime,
  };
}

export async function processWhatsAppMessage(message) {
  if (isHelpMessage(message.text)) {
    await sendWhatsAppText(message.from, WHATSAPP_HELP_TEXT);
    return { status: 'help_sent' };
  }

  const clients = await Client.find({ deletedAt: null, isActive: true });
  const parsedCamps = parseCampMessages(message.text, { from: message.from, knownClients: clients });

  if (!parsedCamps.length) {
    await sendWhatsAppText(message.from, 'Could not read camp details. Reply HELP for the required format.');
    return { status: 'invalid', errors: ['No camp data found'] };
  }

  const createdBy = await resolveCreatedByUser(message.from);
  const submittedAt = message.timestamp
    ? new Date(Number(message.timestamp) * 1000)
    : new Date();

  const results = [];
  for (const camp of parsedCamps) {
    const result = await createCampFromWhatsAppRow({
      row: { ...camp.row, partial: camp.partial },
      rowNumber: camp.rowNumber,
      message,
      createdBy,
      submittedAt,
    });
    results.push({ ...result, partial: camp.partial, partialFields: camp.partialFields });
  }

  const replyText = buildWhatsAppAutoReply({ results });
  await sendWhatsAppText(message.from, replyText);

  const created = results.filter((item) => item.status === 'created');
  return {
    status: created.length ? 'processed' : 'no_camps_created',
    createdCount: created.length,
    results,
  };
}
