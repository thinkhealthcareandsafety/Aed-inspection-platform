import { Router, Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import { Inspection } from '../../models/Inspection';
import { createError } from '../middleware/error-handler';
import { renderInspectionPdf } from '../../services/reportService';

const router = Router();

// GET /api/v1/reports/:inspectionId/pdf
router.get('/:inspectionId/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await Inspection.findOne({
      inspectionId: req.params.inspectionId,
    }).populate('inspector', 'name email').lean();

    if (!inspection) throw createError('Inspection not found', 404, 'NOT_FOUND');

    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="aed-inspection-${inspection.inspectionId}.pdf"`,
    );
    doc.pipe(res);
    renderInspectionPdf(doc, inspection);
    doc.end();
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/reports/:inspectionId/json
router.get('/:inspectionId/json', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await Inspection.findOne({ inspectionId: req.params.inspectionId })
      .populate('inspector', 'name email')
      .lean();
    if (!inspection) throw createError('Inspection not found', 404, 'NOT_FOUND');
    res.json({ report: inspection });
  } catch (err) {
    next(err);
  }
});

export default router;
