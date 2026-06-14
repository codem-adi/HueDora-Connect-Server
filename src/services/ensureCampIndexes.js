import Camp from '../models/Camp.js';

export async function ensureCampIndexes() {
  const whatsappUnset = await Camp.updateMany(
    { source: { $ne: 'whatsapp' }, whatsappMessageId: null },
    { $unset: { whatsappMessageId: 1 } }
  );
  const emailUnset = await Camp.updateMany(
    { source: { $ne: 'email' }, emailIngestId: null },
    { $unset: { emailIngestId: 1 } }
  );

  if (whatsappUnset.modifiedCount || emailUnset.modifiedCount) {
    console.log(
      `[db] Cleared null ingest ids | whatsappMessageId=${whatsappUnset.modifiedCount} | emailIngestId=${emailUnset.modifiedCount}`
    );
  }

  await Camp.syncIndexes();
}
