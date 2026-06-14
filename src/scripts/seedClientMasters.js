import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Client from '../models/Client.js';
import ClientMaster from '../models/ClientMaster.js';
import { CLIENT_CODE_BY_NAME, CLIENT_MASTER_SEED_ROWS } from '../utils/clientMasterSeedData.js';

async function ensureClient(name) {
  const code = CLIENT_CODE_BY_NAME[name] || name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 12);
  let client = await Client.findOne({ deletedAt: null, name });
  if (!client) {
    let uniqueCode = code;
    let suffix = 1;
    while (await Client.findOne({ deletedAt: null, code: uniqueCode })) {
      uniqueCode = `${code}${suffix++}`;
    }
    client = await Client.create({ name, code: uniqueCode, isActive: true });
    console.log(`Created client: ${name}`);
    return client;
  }
  return client;
}

async function seedClientMasters() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/k_dashboard';
  await connectDB(uri);

  let created = 0;
  let skipped = 0;

  for (const row of CLIENT_MASTER_SEED_ROWS) {
    const client = await ensureClient(row.clientName);
    const existing = await ClientMaster.findOne({
      deletedAt: null,
      client: client._id,
      programName: row.programName,
      campName: row.campName,
      campType: row.campType,
    });

    if (existing) {
      Object.assign(existing, { ...row, clientName: client.name, isActive: true });
      await existing.save();
      skipped += 1;
      console.log(`Updated master: ${row.clientName} / ${row.programName}`);
      continue;
    }

    await ClientMaster.create({
      client: client._id,
      clientName: client.name,
      ...row,
      isActive: true,
    });
    created += 1;
    console.log(`Created master: ${row.clientName} / ${row.programName}`);
  }

  console.log(`Done. Created ${created}, updated ${skipped}.`);
  await mongoose.disconnect();
}

seedClientMasters().catch((err) => {
  console.error(err);
  process.exit(1);
});
