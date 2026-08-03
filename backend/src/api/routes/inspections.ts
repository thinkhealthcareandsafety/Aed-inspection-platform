import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { Inspection } from '../../models/Inspection';
import { createError } from '../middleware/error-handler';
import { logger } from '../../utils/logger';

const router = Router();

const createSchema = z.object({
  locationId: z.string().optional(),
  notes: z.string().optional(),
});

const updateSchema = z.object({
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  padsExpiry: z.string().optional(),
  batteryExpiry: z.string().optional(),
  statusIndicator: z.string().optional(),
  inspectionResult: z.enum(['PASS', 'FAIL', 'REVIEW', 'INCOMPLETE']).optional(),
  inspectionStatus: z.enum(['in_progress', 'complete', 'error']).optional(),
  completedAt: z.string().optional(),
  durationSeconds: z.number().optional(),
  cvSessionData: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
});

// GET /api/v1/inspections
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Number(req.query.limit) || 20);
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (req.user!.role === 'inspector') {
      filter.inspector = req.user!.userId;
    }
    if (req.query.result) filter.inspectionResult = req.query.result;
    if (req.query.manufacturer) filter.manufacturer = new RegExp(String(req.query.manufacturer), 'i');
    if (req.query.locationId) filter.locationId = req.query.locationId;

    const [inspections, total] = await Promise.all([
      Inspection.find(filter)
        .populate('inspector', 'name email')
        .sort({ startedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Inspection.countDocuments(filter),
    ]);

    res.json({
      data: inspections,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/inspections — create new session
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = createSchema.parse(req.body);
    const inspectionId = uuidv4();
    const sessionId = uuidv4();

    const inspection = await Inspection.create({
      inspectionId,
      sessionId,
      inspector: req.user!.userId,
      locationId: body.locationId,
      notes: body.notes,
      startedAt: new Date(),
      inspectionStatus: 'in_progress',
      inspectionResult: 'INCOMPLETE',
    });

    logger.info('inspection.created', {
      inspectionId,
      inspector: req.user!.userId,
    });

    res.status(201).json({ inspection });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inspections/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await Inspection.findOne({ inspectionId: req.params.id })
      .populate('inspector', 'name email')
      .lean();
    if (!inspection) throw createError('Inspection not found', 404, 'NOT_FOUND');
    res.json({ inspection });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/v1/inspections/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { model, ...rest } = updateSchema.parse(req.body);
    const update = model !== undefined ? { ...rest, aedModel: model } : rest;
    const inspection = await Inspection.findOneAndUpdate(
      { inspectionId: req.params.id },
      { $set: update },
      { new: true },
    ).lean();
    if (!inspection) throw createError('Inspection not found', 404, 'NOT_FOUND');
    res.json({ inspection });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/inspections/stats/summary
router.get('/stats/summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const filter: Record<string, unknown> =
      req.user!.role === 'inspector' ? { inspector: req.user!.userId } : {};

    const [total, passed, failed, review, recent] = await Promise.all([
      Inspection.countDocuments(filter),
      Inspection.countDocuments({ ...filter, inspectionResult: 'PASS' }),
      Inspection.countDocuments({ ...filter, inspectionResult: 'FAIL' }),
      Inspection.countDocuments({ ...filter, inspectionResult: 'REVIEW' }),
      Inspection.countDocuments({ ...filter, startedAt: { $gte: thirtyDaysAgo } }),
    ]);

    res.json({ total, passed, failed, review, recent, passRate: total ? Math.round((passed / total) * 100) : 0 });
  } catch (err) {
    next(err);
  }
});

export default router;
