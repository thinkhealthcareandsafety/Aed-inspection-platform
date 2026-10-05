/**
 * Shared checklist-item upload/analyze/skip/complete logic, used by both the
 * authenticated staff router (api/routes/checklist.ts) and the public,
 * unauthenticated router (api/routes/public.ts) so the two flows can't drift.
 */
import path from 'path';
import { READY_THRESHOLD, SAFETY_CRITICAL, readinessScore } from '../config/scoring';
import fs from 'fs/promises';
import { randomUUID } from 'crypto';
import { IInspection, IChecklistItemResult } from '../models/Inspection';
import { getChecklistItem, REQUIRED_ITEM_IDS } from '../config/checklist-items';
import { createError } from '../api/middleware/error-handler';
import { config } from '../config/env';
import { logger } from '../utils/logger';
import { toExpiryDate } from '../utils/expiry';

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
  manufacture_date?: string | null;
  /** `notes` in Hindi, when the inspector is using the app in Hindi. The
   *  English `notes` stays the record: the PDF and the sales team read it. */
  notes_hi?: string | null;
}

function syncTopLevelFields(itemId: string, data: AnalysisResponse) {
  switch (itemId) {
    case 'serial_number':
      return data.serial_number ? { serialNumber: data.serial_number } : {};
    case 'pads_expiry':
      // The parsed date is what the replacement pipeline queries on; the raw
      // string stays for the report, which should show what the label said.
      return data.expiry_date
        ? { padsExpiry: data.expiry_date, padsExpiryAt: toExpiryDate(data.expiry_date) }
        : {};
    case 'battery_expiry':
      return {
        ...(data.expiry_date
          ? { batteryExpiry: data.expiry_date, batteryExpiryAt: toExpiryDate(data.expiry_date) }
          : {}),
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

/**
 * The AED fails readiness when its score is below 80, or when any safety
 * check fails whatever the score (see config/scoring). A serial number that
 * couldn't be read costs its 10 marks but doesn't make the unit unready.
 */
export function deriveResult(checklist: IChecklistItemResult[]): 'PASS' | 'FAIL' | 'REVIEW' | 'INCOMPLETE' {
  const required = checklist.filter((c) => REQUIRED_ITEM_IDS.includes(c.itemId));
  if (required.every((c) => c.status === 'pending')) return 'INCOMPLETE';
  if (required.some((c) => c.status === 'fail' && SAFETY_CRITICAL.includes(c.itemId))) return 'FAIL';
  if (required.some((c) => c.status !== 'pass' && c.status !== 'fail')) return 'REVIEW';
  return readinessScore(checklist) < READY_THRESHOLD ? 'FAIL' : 'PASS';
}

/**
 * Extensions come from the declared media type through this allow-list,
 * never from the uploaded filename. The filename is attacker-controlled: an
 * upload named "x.html" used to be written to disk as .html and served from
 * our own domain.
 */
const EXTENSION_FOR_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/3gpp': '.3gp',
};

function assertAcceptableMedia(file: Express.Multer.File, expected: 'image' | 'video'): void {
  const mime = (file.mimetype || '').toLowerCase();
  // Some Android builds send camera captures with no type, or a generic
  // octet-stream. Rejecting those would fail a genuine inspection in the
  // field, so they pass through for the AI to judge — the extension
  // allow-list above still guarantees they are stored as inert media.
  if (!mime || mime === 'application/octet-stream') return;
  // SVG is nominally an image but can carry script.
  if (mime === 'image/svg+xml') {
    throw createError('Please upload a photo or a video.', 400, 'UNSUPPORTED_MEDIA');
  }
  if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
    throw createError('Please upload a photo or a video.', 400, 'UNSUPPORTED_MEDIA');
  }
  if (!mime.startsWith(`${expected}/`)) {
    throw createError(
      expected === 'video'
        ? 'This check needs a short video, not a photo.'
        : 'This check needs a photo, not a video.',
      400,
      'WRONG_MEDIA_TYPE',
    );
  }
}

/**
 * A completed inspection is a record that has been issued — emailed, and
 * possibly handed to an auditor. It must not change afterwards. Before this
 * guard, anyone holding the inspection id could keep uploading to it, and
 * the PDF downloaded later would silently differ from the one sent.
 */
function assertEditable(inspection: IInspection): void {
  if (inspection.inspectionStatus === 'complete') {
    throw createError(
      'This inspection has been completed and its report issued, so it can no longer be changed. Start a new inspection instead.',
      409,
      'INSPECTION_COMPLETE',
    );
  }
}

async function persistUpload(inspectionId: string, itemId: string, file: Express.Multer.File) {
  const dir = path.join(config.UPLOAD_DIR, inspectionId);
  await fs.mkdir(dir, { recursive: true });
  const mime = (file.mimetype || '').toLowerCase();
  const ext = EXTENSION_FOR_MIME[mime] ?? (mime.startsWith('video/') ? '.mp4' : '.jpg');
  const filename = `${itemId}_${randomUUID()}${ext}`;
  await fs.writeFile(path.join(dir, filename), file.buffer);
  return `/uploads/${inspectionId}/${filename}`;
}

/** Languages the inspector's feedback can be written in besides English. */
export const FEEDBACK_LANGUAGES = ['hi'] as const;
export type FeedbackLanguage = (typeof FEEDBACK_LANGUAGES)[number];

export function isFeedbackLanguage(value: unknown): value is FeedbackLanguage {
  return typeof value === 'string' && (FEEDBACK_LANGUAGES as readonly string[]).includes(value);
}

async function callCvService(
  itemId: string,
  file: Express.Multer.File,
  context: { aedModel?: string; lang?: FeedbackLanguage },
): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append(
    'file',
    new Blob([file.buffer], { type: file.mimetype || 'application/octet-stream' }),
    file.originalname || itemId,
  );
  // Which AED is in the photo, so the vision prompt describes that unit and
  // not another brand's — a ZOLL used to be judged as if it were a Philips.
  if (context.aedModel) form.append('aed_model', context.aedModel);
  if (context.lang) form.append('lang', context.lang);

  let res: Response;
  try {
    res = await fetch(`${config.CV_SERVICE_URL}/api/v1/checklist/${itemId}/analyze`, {
      method: 'POST',
      body: form,
    });
  } catch (err) {
    // Couldn't even reach the CV service (network blip, cold start) — always
    // worth a retry.
    throw createError(
      'Could not reach the AI analysis service. Please try again.',
      502,
      'CV_SERVICE_UNREACHABLE',
      true,
    );
  }

  if (!res.ok) {
    const raw = await res.text().catch(() => '');
    let detail = raw;
    try {
      const parsed = JSON.parse(raw) as { detail?: string };
      if (parsed.detail) detail = parsed.detail;
    } catch {
      // Not JSON — use the raw text as-is.
    }

    // 502/503/504 from the CV service means Gemini itself was unavailable or
    // timed out after its own internal retries — a transient upstream issue,
    // not something wrong with this specific photo. Everything else (400/404
    // — unknown item, bad upload) won't be fixed by retrying the same file.
    const retryable = res.status === 502 || res.status === 503 || res.status === 504;
    const message = retryable
      ? 'The AI service is busy right now. Please try again in a moment.'
      : detail || 'AI analysis failed for this photo. Please try a clearer capture.';

    throw createError(message, retryable ? 502 : 400, 'CV_SERVICE_ERROR', retryable);
  }
  return (await res.json()) as AnalysisResponse;
}

export const MAX_ATTEMPTS_PER_ITEM = 12;

export async function analyzeChecklistItem(
  inspection: IInspection,
  itemId: string,
  file: Express.Multer.File,
  options: { lang?: FeedbackLanguage } = {},
): Promise<{ entry: IChecklistItemResult; inspectionResult: string }> {
  const item = getChecklistItem(itemId);
  if (!item) throw createError(`Unknown checklist item '${itemId}'`, 400, 'BAD_ITEM');

  assertEditable(inspection);
  assertAcceptableMedia(file, item.mediaType);

  const entry = inspection.checklist.find((c) => c.itemId === item.id);
  if (!entry) throw createError('Checklist item not initialised on this inspection', 500, 'STATE_ERROR');

  // Enough retakes for any honest inspection (a blurry shot, glare, a fix
  // and re-check), not enough to turn one check into a way of spending the
  // prepaid AI credit.
  if ((entry.attempts ?? 0) >= MAX_ATTEMPTS_PER_ITEM) {
    throw createError(
      'This check has been retaken too many times. Please contact us if you need help.',
      429,
      'TOO_MANY_ATTEMPTS',
    );
  }
  entry.attempts = (entry.attempts ?? 0) + 1;
  entry.status = 'analyzing';
  entry.mediaType = item.mediaType;
  await inspection.save();

  let mediaUrl: string;
  let analysis: AnalysisResponse;
  try {
    [mediaUrl, analysis] = await Promise.all([
      persistUpload(inspection.inspectionId, item.id, file),
      callCvService(item.id, file, { aedModel: inspection.aedModel, lang: options.lang }),
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
  assertEditable(inspection);

  const entry = inspection.checklist.find((c) => c.itemId === item.id);
  if (!entry) throw createError('Checklist item not initialised on this inspection', 500, 'STATE_ERROR');

  entry.status = 'skipped';
  await inspection.save();
  return entry;
}

export async function completeInspection(inspection: IInspection): Promise<IInspection> {
  // Idempotent: completing twice (a double-tap, a network retry) returns the
  // record as issued rather than restamping completedAt and duration on a
  // report that has already gone out.
  if (inspection.inspectionStatus === 'complete') return inspection;

  inspection.inspectionResult = deriveResult(inspection.checklist);
  inspection.inspectionStatus = 'complete';
  inspection.completedAt = new Date();
  inspection.durationSeconds = (inspection.completedAt.getTime() - inspection.startedAt.getTime()) / 1000;
  await inspection.save();
  return inspection;
}
