/**
 * Shared checklist-item upload/analyze/skip/complete logic, used by both the
 * authenticated staff router (api/routes/checklist.ts) and the public,
 * unauthenticated router (api/routes/public.ts) so the two flows can't drift.
 */
import path from 'path';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { IInspection, IChecklistItemResult } from '../models/Inspection';
import { getChecklistItem, REQUIRED_ITEM_IDS } from '../config/checklist-items';
import { createError } from '../api/middleware/error-handler';
import { config } from '../config/env';
import { logger } from '../utils/logger';

export interface AnalysisResponse {
  passed: boolean;
  confidence: number;
  notes: string;
  serial_number?: string | null;
  expiry_date?: string | null;
  expiry_raw_text?: string | null;
  lot_number?: string | null;
  battery_serial_number?: string | null;
  present?: boolean | null;
  status?: string | null;
}

function syncTopLevelFields(itemId: string, data: AnalysisResponse) {
  switch (itemId) {
    case 'serial_number':
      return data.serial_number ? { serialNumber: data.serial_number } : {};
    case 'pads_expiry':
      return data.expiry_date ? { padsExpiry: data.expiry_date } : {};
    case 'battery_expiry':
      return {
        ...(data.expiry_date ? { batteryExpiry: data.expiry_date } : {}),
        ...(data.lot_number ? { batteryLot: data.lot_number } : {}),
        ...(data.battery_serial_number ? { batterySerialNumber: data.battery_serial_number } : {}),
      };
    case 'readiness_indicator':
      return {
        ...(data.status ? { statusIndicator: data.status } : {}),
        statusConfidence: data.confidence,
      };
    default:
      return {};
  }
}

export function deriveResult(checklist: IChecklistItemResult[]): 'PASS' | 'FAIL' | 'REVIEW' | 'INCOMPLETE' {
  const required = checklist.filter((c) => REQUIRED_ITEM_IDS.includes(c.itemId));
  if (required.every((c) => c.status === 'pending')) return 'INCOMPLETE';
  if (required.some((c) => c.status === 'fail')) return 'FAIL';
  if (required.every((c) => c.status === 'pass')) return 'PASS';
  return 'REVIEW';
}

async function persistUpload(inspectionId: string, itemId: string, file: Express.Multer.File) {
  const dir = path.join(config.UPLOAD_DIR, inspectionId);
  await fs.mkdir(dir, { recursive: true });
  const ext = path.extname(file.originalname) || (file.mimetype.startsWith('video') ? '.mp4' : '.jpg');
  const filename = `${itemId}_${randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, filename), file.buffer);
  return `/uploads/${inspectionId}/${filename}`;
}

async function callCvService(itemId: string, file: Express.Multer.File): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }),
    file.originalname || itemId,
  );

  const res = await fetch(`${config.CV_SERVICE_URL}/api/v1/checklist/${itemId}/analyze`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw createError(`AI analysis failed (${res.status}): ${detail}`, 502, 'CV_SERVICE_ERROR');
  }
  return (await res.json()) as AnalysisResponse;
}

export async function analyzeChecklistItem(
  inspection: IInspection,
  itemId: string,
  file: Express.Multer.File,
): Promise<{ entry: IChecklistItemResult; inspectionResult: string }> {
  const item = getChecklistItem(itemId);
  if (!item) throw createError(`Unknown checklist item '${itemId}'`, 400, 'BAD_ITEM');

  const entry = inspection.checklist.find((c) => c.itemId === item.id);
  if (!entry) throw createError('Checklist item not initialised on this inspection', 500, 'STATE_ERROR');

  entry.status = 'analyzing';
  entry.mediaType = item.mediaType;
  await inspection.save();

  let mediaUrl: string;
  let analysis: AnalysisResponse;
  try {
    [mediaUrl, analysis] = await Promise.all([
      persistUpload(inspection.inspectionId, item.id, file),
      callCvService(item.id, file),
    ]);
  } catch (err) {
    entry.status = 'error';
    entry.notes = err instanceof Error ? err.message : 'Analysis failed';
    await inspection.save();
    throw err;
  }

  entry.status = analysis.passed ? 'pass' : 'fail';
  entry.mediaUrl = mediaUrl;
  entry.confidence = analysis.confidence;
  entry.notes = analysis.notes;
  entry.aiData = analysis as unknown as Record<string, unknown>;
  entry.uploadedAt = new Date();
  entry.analyzedAt = new Date();

  Object.assign(inspection, syncTopLevelFields(item.id, analysis));
  inspection.inspectionResult = deriveResult(inspection.checklist);

  await inspection.save();

  logger.info('checklist.item_analyzed', {
    inspectionId: inspection.inspectionId,
    itemId: item.id,
    status: entry.status,
  });

  return { entry, inspectionResult: inspection.inspectionResult };
}

export async function skipChecklistItem(inspection: IInspection, itemId: string): Promise<IChecklistItemResult> {
  const item = getChecklistItem(itemId);
  if (!item) throw createError(`Unknown checklist item '${itemId}'`, 400, 'BAD_ITEM');
  if (item.required) throw createError('Required items cannot be skipped', 400, 'ITEM_REQUIRED');

  const entry = inspection.checklist.find((c) => c.itemId === item.id);
  if (!entry) throw createError('Checklist item not initialised on this inspection', 500, 'STATE_ERROR');

  entry.status = 'skipped';
  await inspection.save();
  return entry;
}

export async function completeInspection(inspection: IInspection): Promise<IInspection> {
  inspection.inspectionResult = deriveResult(inspection.checklist);
  inspection.inspectionStatus = 'complete';
  inspection.completedAt = new Date();
  inspection.durationSeconds = (inspection.completedAt.getTime() - inspection.startedAt.getTime()) / 1000;
  await inspection.save();
  return inspection;
}
