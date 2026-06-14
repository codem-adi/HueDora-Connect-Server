import Camp from '../models/Camp.js';
import { CAMP_NAME_OPTIONS, isValidCampName, normalizeCampName } from '../config/campNames.js';

export async function ensureCampDataIntegrity() {
  const rescheduledCount = await Camp.updateMany(
    { deletedAt: null, status: 'rescheduled' },
    { $set: { status: 'approved' } },
    { runValidators: false }
  );
  if (rescheduledCount.modifiedCount > 0) {
    console.log(`[db] Migrated ${rescheduledCount.modifiedCount} rescheduled camp(s) to approved`);
  }

  const invalidCamps = await Camp.find({
    deletedAt: null,
    campaignName: { $nin: CAMP_NAME_OPTIONS },
  }).select('_id campId campaignName');

  if (!invalidCamps.length) return;

  let fixed = 0;
  for (const camp of invalidCamps) {
    const normalized = normalizeCampName(camp.campaignName);
    if (!isValidCampName(normalized)) continue;

    await Camp.updateOne(
      { _id: camp._id },
      { $set: { campaignName: normalized } },
      { runValidators: false }
    );
    fixed += 1;
  }

  console.log(
    `[db] Normalized invalid campaignName on ${fixed}/${invalidCamps.length} camp(s)`
  );
}
