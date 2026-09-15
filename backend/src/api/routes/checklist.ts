import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { Inspection } from '../../models/Inspection';
import { CHECKLIST_ITEMS } from '../../config/checklist-items';
import { createError } from '../middleware/error-handler';
import { config } from '../../config/env';
import { analyzeChecklistItem, skipChecklistItem, completeInspection } from '../../services/checklistService';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_FILE_SIZE_MB * 1024 * 1024 },
});

async function loadInspection(inspectionId: string | string[]) {
  const inspection = await Inspection.findOne({ inspectionId: String(inspectionId) });
  if (!inspection) throw createError('Inspection not found', 404, 'NOT_FOUND');
  return inspection;
}

// GET /api/v1/inspections/:id/checklist — catalogue merged with current state
router.get('/:id/checklist', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await loadInspection(req.params.id);
    res.json({ checklist: inspection.checklist });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inspections/:id/checklist/:itemId — upload photo/video, analyze, persist
router.post(
  '/:id/checklist/:itemId',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) throw createError('No file uploaded', 400, 'NO_FILE');
      const inspection = await loadInspection(req.params.id);
      const { entry, inspectionResult } = await analyzeChecklistItem(inspection, String(req.params.itemId), req.file);
      res.json({ item: entry, inspectionResult });
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/v1/inspections/:id/checklist/:itemId/skip — optional items only
router.post('/:id/checklist/:itemId/skip', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await loadInspection(req.params.id);
    const entry = await skipChecklistItem(inspection, String(req.params.itemId));
    res.json({ item: entry });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inspections/:id/complete — finalize the inspection
router.post('/:id/complete', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await loadInspection(req.params.id);
    const updated = await completeInspection(inspection);
    res.json({ inspection: updated });
  } catch (err) {
    next(err);
  }
});

export { CHECKLIST_ITEMS };
export default router;
