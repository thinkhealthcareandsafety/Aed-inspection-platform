/**
 * Public, unauthenticated inspection flow for walk-up inspectors landing on
 * inspector.aedsmartx.com: submit contact details + pick an AED model, run
 * the same AI-assisted checklist as the staff flow, then email the finished
 * PDF report to the inspector and to config.REPORT_BCC_EMAIL.
 */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Inspection, REPLACEMENT_ITEMS } from '../../models/Inspection';
import { createError } from '../middleware/error-handler';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import { isPublicAedModel, PUBLIC_AED_MODELS } from '../../config/aed-models';
import { analyzeChecklistItem, skipChecklistItem, completeInspection } from '../../services/checklistService';
import { createReportDoc, renderInspectionPdf, generateInspectionPdfBuffer } from '../../services/reportService';
import { sendInspectionReportEmail, sendReplacementRequestEmail } from '../../services/emailService';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

const createSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().min(6, 'Enter a valid mobile number').max(30),
  aedModel: z.string().refine(isPublicAedModel, {
    message: `AED model must be one of: ${PUBLIC_AED_MODELS.join(', ')}`,
  }),
});

const replacementSchema = z.object({
  items: z.array(z.enum(REPLACEMENT_ITEMS)).min(1).max(REPLACEMENT_ITEMS.length),
});

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
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw createError('No file uploaded', 400, 'NO_FILE');
      const inspection = await loadPublicInspection(req.params.id);
      const { entry, inspectionResult } = await analyzeChecklistItem(inspection, String(req.params.itemId), req.file);
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

    const completed = await completeInspection(inspection);

    const pdfBuffer = await generateInspectionPdfBuffer(completed.toObject());
    const emailResult = await sendInspectionReportEmail({
      inspectionId: completed.inspectionId,
      aedModel: completed.aedModel,
      inspectionResult: completed.inspectionResult,
      guestName: completed.guestName,
      guestEmail: completed.guestEmail,
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
