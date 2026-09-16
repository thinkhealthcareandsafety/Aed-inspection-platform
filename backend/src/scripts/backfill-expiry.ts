/**
 * One-off backfill: derive padsExpiryAt / batteryExpiryAt for inspections
 * recorded before those fields existed.
 *
 * Without it, every AED inspected up to now is invisible to the replacement
 * pipeline — the expiry is sitting in the record as a string, unqueryable.
 *
 * Run against production once, after deploying — from the Render shell for
 * aed-backend, where dist/ and the environment are already in place:
 *   npm run backfill:expiry
 *
 * Safe to run repeatedly: it only touches documents that are missing the
 * derived date, and never overwrites one that is already there.
 */
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database';
import { Inspection } from '../models/Inspection';
import { toExpiryDate } from '../utils/expiry';
import { logger } from '../utils/logger';

async function main() {
  await connectDatabase();

  const candidates = await Inspection.find({
    $or: [
      { padsExpiry: { $type: 'string' }, padsExpiryAt: { $exists: false } },
      { batteryExpiry: { $type: 'string' }, batteryExpiryAt: { $exists: false } },
    ],
  }).select('inspectionId padsExpiry padsExpiryAt batteryExpiry batteryExpiryAt');

  let updated = 0;
  let unparsable = 0;

  for (const doc of candidates) {
    const pads = doc.padsExpiryAt ?? toExpiryDate(doc.padsExpiry);
    const battery = doc.batteryExpiryAt ?? toExpiryDate(doc.batteryExpiry);

    if (!pads && !battery) {
      // A label the parser can't read is worth knowing about — it means the
      // CV service handed back a format we don't normalise.
      unparsable += 1;
      logger.warn('backfill.unparsable_expiry', {
        inspectionId: doc.inspectionId,
        padsExpiry: doc.padsExpiry,
        batteryExpiry: doc.batteryExpiry,
      });
      continue;
    }

    if (pads) doc.padsExpiryAt = pads;
    if (battery) doc.batteryExpiryAt = battery;
    await doc.save();
    updated += 1;
  }

  logger.info('backfill.complete', { examined: candidates.length, updated, unparsable });
  await mongoose.disconnect();
}

main().catch(async (err) => {
  logger.error('backfill.failed', { message: (err as Error).message });
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
