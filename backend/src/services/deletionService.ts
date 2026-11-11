import fs from 'fs/promises';
import path from 'path';
import { config } from '../config/env';
import { Inspection } from '../models/Inspection';
import { AnalyticsEvent } from '../models/AnalyticsEvent';
import { logger } from '../utils/logger';

/** Inspection ids are v4 UUIDs. Anything else never reaches the filesystem. */
const INSPECTION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isInspectionId(value: unknown): value is string {
  return typeof value === 'string' && INSPECTION_ID.test(value);
}

/** The folder holding one inspection's photos and videos, or null if the id
 *  could resolve anywhere but directly inside the uploads folder. */
function uploadsFolderOf(inspectionId: string): string | null {
  if (!isInspectionId(inspectionId)) return null;
  const root = path.resolve(config.UPLOAD_DIR);
  const dir = path.resolve(root, inspectionId);
  return path.dirname(dir) === root ? dir : null;
}

/**
 * Permanently removes inspections: the records, the photos and videos taken
 * for them, and the funnel events tied to them. Ids that don't exist are
 * skipped, so a second click on the same row is harmless. Returns how many
 * inspections were actually deleted.
 */
export async function deleteInspections(ids: string[], deletedBy: string): Promise<number> {
  const valid = [...new Set(ids.filter(isInspectionId))];
  if (!valid.length) return 0;

  const found = await Inspection.find({ inspectionId: { $in: valid } }, { inspectionId: 1 }).lean();
  const existing = found.map((i) => i.inspectionId);
  if (!existing.length) return 0;

  // The record goes first: if removing a folder then fails, the inspection is
  // already gone from the dashboard and only an unreachable folder is left.
  const { deletedCount } = await Inspection.deleteMany({ inspectionId: { $in: existing } });
  await AnalyticsEvent.deleteMany({ inspectionId: { $in: existing } });

  await Promise.all(
    existing.map(async (id) => {
      const dir = uploadsFolderOf(id);
      if (!dir) return;
      try {
        await fs.rm(dir, { recursive: true, force: true });
      } catch (err) {
        logger.warn('inspection.delete.uploads_left', { inspectionId: id, error: String(err) });
      }
    }),
  );

  logger.info('inspection.deleted', { count: deletedCount, inspectionIds: existing, deletedBy });
  return deletedCount ?? 0;
}

/** Clears every funnel and visitor event. Inspections are not touched. */
export async function clearFunnelEvents(deletedBy: string): Promise<number> {
  const { deletedCount } = await AnalyticsEvent.deleteMany({});
  logger.info('funnel.events_cleared', { count: deletedCount, deletedBy });
  return deletedCount ?? 0;
}
