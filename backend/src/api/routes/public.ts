/**
 * Public, unauthenticated inspection flow for walk-up inspectors landing on
 * inspector.aedsmartx.com: submit contact details + pick an AED model, run
 * the same AI-assisted checklist as the staff flow, then email the finished
 * PDF report to the inspector and to config.REPORT_BCC_EMAIL.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Inspection, REPLACEMENT_ITEMS } from '../../models/Inspection';
import { ModelRequest } from '../../models/ModelRequest';
import { createError } from '../middleware/error-handler';
import { singleMediaUpload } from '../middleware/upload';
import { config } from '../../config/env';
import { readinessScore } from '../../config/scoring';
import { logger } from '../../utils/logger';
import { isPublicAedModel, PUBLIC_AED_MODELS } from '../../config/aed-models';
import {
  analyzeChecklistItem,
  completeInspection,
  quickCheckDone,
  isFeedbackLanguage,
  skipChecklistItem,
} from '../../services/checklistService';
import { createReportDoc, renderInspectionPdf, generateInspectionPdfBuffer } from '../../services/reportService';
import {
  sendInspectionReportEmail,
  sendModelRequestEmail,
  sendReplacementRequestEmail,
} from '../../services/emailService';

const router = Router();

const createSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().min(6, 'Enter a valid mobile number').max(30),
  aedModel: z.string().refine(isPublicAedModel, {
    message: `AED model must be one of: ${PUBLIC_AED_MODELS.join(', ')}`,
  }),
  // Only a zone the runtime knows is kept; anything else is dropped rather
  // than refusing the inspection, and the report uses its default zone.
  timeZone: z.string().max(64).refine(isTimeZone).optional().catch(undefined),
});

function isTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** How the inspector finished: after the quick check, or every check. */
const completeSchema = z
  .object({ scope: z.enum(['quick', 'full']).default('full') })
  .default({ scope: 'full' });

const replacementSchema = z.object({
  items: z.array(z.enum(REPLACEMENT_ITEMS)).min(1).max(REPLACEMENT_ITEMS.length),
});

const modelRequestSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().min(6, 'Enter a valid mobile number').max(30),
  brand: z.string().trim().min(2, 'Choose a brand').max(60),
  model: z.string().trim().max(80).optional(),
});

/** Asking twice about the same unit is one request, not two emails. */
const MODEL_REQUEST_DEDUPE_MS = 24 * 60 * 60 * 1000;

async function loadPublicInspection(inspectionId: string | string[]) {
  const inspection = await Inspection.findOne({ inspectionId: String(inspectionId), source: 'public' });
  if (!inspection) throw createError('Inspection not found', 404, 'NOT_FOUND');
  return inspection;
}

// GET /api/v1/public/aed-models — the selectable model list (single source of truth)
router.get('/aed-models', (_req: Request, res: Response) => {
  res.json({ models: PUBLIC_AED_MODELS });
});

// POST /api/v1/public/inspections — start a guest inspection session
router.post('/inspections', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const inspection = await Inspection.create({
      inspectionId: uuidv4(),
      sessionId: uuidv4(),
      source: 'public',
      guestName: body.name,
      guestEmail: body.email,
      guestPhone: body.phone,
      aedModel: body.aedModel,
      timeZone: body.timeZone,
      startedAt: new Date(),
      inspectionStatus: 'in_progress',
      inspectionResult: 'INCOMPLETE',
    });

    logger.info('public_inspection.created', { inspectionId: inspection.inspectionId, aedModel: body.aedModel });
    res.status(201).json({ inspection });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(createError(err.errors[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR'));
      return;
    }
    next(err);
  }
});

// POST /api/v1/public/model-requests — the visitor's AED isn't one the app
// supports yet. Keep them as a lead instead of losing them at the picker.
router.post('/model-requests', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = modelRequestSchema.parse(req.body);
    const email = body.email.toLowerCase();

    // A double tap, a retry or a script must not mail the sales inbox over
    // and over — the same rule as the report and quote emails.
    const existing = await ModelRequest.findOne({
      email,
      brand: body.brand,
      createdAt: { $gte: new Date(Date.now() - MODEL_REQUEST_DEDUPE_MS) },
    });
    if (existing) {
      res.json({ request: { brand: existing.brand, model: existing.aedModel, createdAt: existing.createdAt } });
      return;
    }

    const { model, ...contact } = body;
    const request = await ModelRequest.create({ ...contact, email, aedModel: model });
    logger.info('public.model_requested', { brand: request.brand });

    // The request is kept either way; a mail failure is logged, not shown.
    await sendModelRequestEmail({
      name: request.name,
      email: request.email,
      phone: request.phone,
      brand: request.brand,
      model: request.aedModel,
    });

    res.status(201).json({ request: { brand: request.brand, model: request.aedModel, createdAt: request.createdAt } });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(createError(err.errors[0]?.message ?? 'Invalid input', 400, 'VALIDATION_ERROR'));
      return;
    }
    next(err);
  }
});

// GET /api/v1/public/inspections/:id
router.get('/inspections/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await loadPublicInspection(req.params.id);
    res.json({ inspection });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/public/inspections/:id/checklist/:itemId
router.post(
  '/inspections/:id/checklist/:itemId',
  singleMediaUpload('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw createError('No file uploaded', 400, 'NO_FILE');
      const inspection = await loadPublicInspection(req.params.id);
      // The inspector's language travels with the upload (a multipart text
      // field), so feedback follows a mid-inspection switch of language.
      const lang = isFeedbackLanguage(req.body?.lang) ? req.body.lang : undefined;
      const { entry, inspectionResult } = await analyzeChecklistItem(
        inspection,
        String(req.params.itemId),
        req.file,
        { lang, guided: req.body?.capture === 'guided' },
      );
      res.json({ item: entry, inspectionResult });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/public/inspections/:id/checklist/:itemId/skip
router.post('/inspections/:id/checklist/:itemId/skip', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await loadPublicInspection(req.params.id);
    const entry = await skipChecklistItem(inspection, String(req.params.itemId));
    res.json({ item: entry });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/public/inspections/:id/complete — finalize, generate PDF, email it out
router.post('/inspections/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await loadPublicInspection(req.params.id);

    // Already issued: hand back what was issued. Re-running would re-send the
    // report email on every call — an unauthenticated way to make this
    // server mail an address over and over.
    if (inspection.inspectionStatus === 'complete') {
      res.json({
        inspection,
        email: {
          sent: Boolean(inspection.emailSentAt),
          recipients: [inspection.guestEmail, config.REPORT_BCC_EMAIL].filter(Boolean),
          ...(inspection.emailSentAt ? {} : { reason: 'Already completed' }),
        },
      });
      return;
    }

    const { scope } = completeSchema.parse(req.body ?? {});
    // A quick-check report vouches for the readiness indicator and serial
    // number; it can't be issued before both have been answered.
    if (scope === 'quick' && !quickCheckDone(inspection.checklist)) {
      throw createError(
        'Check the readiness indicator and the serial number before finishing the quick check.',
        400,
        'QUICK_CHECK_INCOMPLETE',
      );
    }

    const completed = await completeInspection(inspection, scope);

    const pdfBuffer = await generateInspectionPdfBuffer(completed.toObject());
    const emailResult = await sendInspectionReportEmail({
      inspectionId: completed.inspectionId,
      aedModel: completed.aedModel,
      inspectionResult: completed.inspectionResult,
      guestName: completed.guestName,
      guestEmail: completed.guestEmail,
      // The score is out of all ten checks; a quick check reports its verdict
      // without one rather than a misleading 40 out of 100.
      score: scope === 'full' ? readinessScore(completed.checklist) : undefined,
      quick: scope === 'quick',
      pdfBuffer,
    });

    if (emailResult.sent) {
      completed.emailSentAt = new Date();
      await completed.save();
    }

    res.json({ inspection: completed, email: emailResult });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/public/inspections/:id/replacement-request — the customer asked
// to be quoted for replacement pads, a battery or accessories. Stored on the
// inspection (so the sales pipeline can show it) and mailed to the team.
router.post('/inspections/:id/replacement-request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { items } = replacementSchema.parse(req.body);
    const inspection = await loadPublicInspection(req.params.id);

    // One request per inspection. A double tap, a retry or a script must not
    // mail the sales inbox over and over — the same rule as the report email.
    if (inspection.replacementRequest?.requestedAt) {
      res.json({ replacementRequest: inspection.replacementRequest });
      return;
    }

    inspection.replacementRequest = { items: [...new Set(items)], requestedAt: new Date() };
    await inspection.save();

    logger.info('public_inspection.replacement_requested', {
      inspectionId: inspection.inspectionId,
      items: inspection.replacementRequest.items,
    });

    // The request is saved either way; a mail failure is logged, not shown
    // to a customer who has done everything right.
    await sendReplacementRequestEmail({
      inspectionId: inspection.inspectionId,
      items: inspection.replacementRequest.items,
      aedModel: inspection.aedModel,
      serialNumber: inspection.serialNumber,
      padsExpiry: inspection.padsExpiry,
      batteryExpiry: inspection.batteryExpiry,
      inspectionResult: inspection.inspectionResult,
      guestName: inspection.guestName,
      guestEmail: inspection.guestEmail,
      guestPhone: inspection.guestPhone,
    });

    res.status(201).json({ replacementRequest: inspection.replacementRequest });
  } catch (err) {
    if (err instanceof z.ZodError) {
      next(createError('Choose what you would like a quote for', 400, 'VALIDATION_ERROR'));
      return;
    }
    next(err);
  }
});

// GET /api/v1/public/inspections/:id/report/pdf — immediate in-browser download
router.get('/inspections/:id/report/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await loadPublicInspection(req.params.id);

    const doc = createReportDoc();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="aed-inspection-${inspection.inspectionId}.pdf"`);
    doc.pipe(res);
    renderInspectionPdf(doc, inspection.toObject());
    doc.end();
  } catch (err) {
    next(err);
  }
});

export default router;
