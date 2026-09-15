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
import { Inspection } from '../../models/Inspection';
import { createError } from '../middleware/error-handler';
import { config } from '../../config/env';
import { logger } from '../../utils/logger';
import { isPublicAedModel, PUBLIC_AED_MODELS } from '../../config/aed-models';
import { analyzeChecklistItem, skipChecklistItem, completeInspection } from '../../services/checklistService';
import { createReportDoc, renderInspectionPdf, generateInspectionPdfBuffer } from '../../services/reportService';
import { sendInspectionReportEmail } from '../../services/emailService';

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
