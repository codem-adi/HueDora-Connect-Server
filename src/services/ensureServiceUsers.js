import User from '../models/User.js';
import Client from '../models/Client.js';
import { ROLES } from '../config/constants.js';
import { PENDING_IMPORT_CLIENT_NAME } from '../utils/campMessageParser.js';

export const PENDING_EMAIL_CLIENT_CODE = 'EMAIL-PENDING';
export const PENDING_EMAIL_CLIENT_NAME = PENDING_IMPORT_CLIENT_NAME;

const SERVICE_BOTS = [
  {
    envKey: 'WHATSAPP_SERVICE_USER_EMAIL',
    defaultEmail: 'whatsapp-bot@huedoraconnect.com',
    name: 'WhatsApp Bot',
  },
  {
    envKey: 'EMAIL_SERVICE_USER_EMAIL',
    defaultEmail: 'email-bot@huedoraconnect.com',
    name: 'Email Bot',
  },
];

export async function ensurePendingEmailClient() {
  const existing = await Client.findOne({ code: PENDING_EMAIL_CLIENT_CODE, deletedAt: null });
  if (existing) return existing;

  const client = await Client.create({
    name: PENDING_EMAIL_CLIENT_NAME,
    code: PENDING_EMAIL_CLIENT_CODE,
  });

  console.log(`[ingest] Created pending email client ${PENDING_EMAIL_CLIENT_NAME}`);
  return client;
}

export async function ensureServiceUsers() {
  // Sparse unique index ignores missing fields, but multiple explicit nulls collide.
  await User.updateMany(
    { $or: [{ whatsappPhone: null }, { whatsappPhone: '' }] },
    { $unset: { whatsappPhone: '' } },
  );

  for (const bot of SERVICE_BOTS) {
    const email = (process.env[bot.envKey] || bot.defaultEmail).toLowerCase();
    const existing = await User.findOne({ email, deletedAt: null });
    if (existing) continue;

    await User.create({
      name: bot.name,
      email,
      password: 'service-bot-not-for-login',
      role: ROLES.OPERATIONS_EXECUTIVE,
    });

    console.log(`[ingest] Created service user ${email}`);
  }

  await ensurePendingEmailClient();
}
