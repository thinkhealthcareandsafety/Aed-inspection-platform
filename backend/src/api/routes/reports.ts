import { Router, Request, Response, NextFunction } from 'express';
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { Inspection } from '../../models/Inspection';
import { CHECKLIST_ITEMS, getChecklistItem } from '../../config/checklist-items';
import { createError } from '../middleware/error-handler';
import { config } from '../../config/env';

const router = Router();

const SECTION_TITLES: Record<number, string> = {
  1: 'Section 1 — Consumables & Identification',
  2: 'Section 2 — Physical Status',
  3: 'Section 3 — Accessories & Signage (optional)',
};

function mediaUrlToDiskPath(mediaUrl: string): string {
  return path.join(config.UPLOAD_DIR, mediaUrl.replace(/^\/uploads\//, ''));
}

// GET /api/v1/reports/:inspectionId/pdf
router.get('/:inspectionId/pdf', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const inspection = await Inspection.findOne({
      inspectionId: req.params.inspectionId,
    }).populate('inspector', 'name email').lean();

    if (!inspection) throw createError('Inspection not found', 404, 'NOT_FOUND');

    // Generate PDF
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="aed-inspection-${inspection.inspectionId}.pdf"`,
    );
    doc.pipe(res);

    // ── Header ──────────────────────────────────────────────────
    doc.fontSize(20).font('Helvetica-Bold').text('AED Inspection Report', { align: 'center' });
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#666')
      .text(inspection.aedModel ?? 'Philips HeartStart FRx / HS1', { align: 'center' });
    doc.fillColor('#000').moveDown(0.5);

    const resultColor =
      inspection.inspectionResult === 'PASS'
        ? '#16a34a'
        : inspection.inspectionResult === 'FAIL'
          ? '#dc2626'
          : inspection.inspectionResult === 'REVIEW'
            ? '#d97706'
            : '#6b7280';

    doc
      .fontSize(14)
      .fillColor(resultColor)
      .font('Helvetica-Bold')
      .text(`Result: ${inspection.inspectionResult}`, { align: 'center' });

    doc.fillColor('#000000').moveDown();

    // ── Divider ──────────────────────────────────────────────────
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);

    // ── Summary table ────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(12).text('Summary');
    doc.moveDown(0.3);

    const rows: [string, string][] = [
      ['Inspection ID', inspection.inspectionId],
      ['Date', inspection.startedAt ? new Date(inspection.startedAt).toLocaleString() : 'N/A'],
      [
        'Inspector',
        // @ts-ignore — populated
        inspection.inspector?.name ?? 'Unknown',
      ],
      ['Serial Number', inspection.serialNumber ?? 'Not captured'],
      ['Pads Expiry', inspection.padsExpiry ?? 'Not captured'],
      ['Battery Expiry', inspection.batteryExpiry ?? 'Not captured'],
      ['Battery Lot / Serial', [inspection.batteryLot, inspection.batterySerialNumber].filter(Boolean).join(' / ') || 'Not captured (optional)'],
      ['Readiness Indicator', inspection.statusIndicator ?? 'Not checked'],
      [
        'Readiness Confidence',
        inspection.statusConfidence ? `${Math.round(inspection.statusConfidence * 100)}%` : 'N/A',
      ],
      [
        'Duration',
        inspection.durationSeconds ? `${Math.round(inspection.durationSeconds)}s` : 'N/A',
      ],
      ['Location', inspection.locationId ?? 'Not specified'],
      ['Notes', inspection.notes ?? '—'],
    ];

    doc.font('Helvetica').fontSize(10);
    for (const [label, value] of rows) {
      doc.font('Helvetica-Bold').text(label + ': ', { continued: true }).font('Helvetica').text(value);
    }

    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);

    // ── Checklist ────────────────────────────────────────────────
    doc.font('Helvetica-Bold').fontSize(12).fillColor('#000').text('Inspection Checklist (10 items, 3 sections)');
    doc.moveDown(0.4);

    const STATUS_LABEL: Record<string, string> = {
      pass: 'PASS',
      fail: 'FAIL',
      skipped: 'SKIPPED',
      pending: 'NOT DONE',
      uploaded: 'PENDING REVIEW',
      analyzing: 'PENDING REVIEW',
      error: 'ERROR',
    };
    const STATUS_COLOR: Record<string, string> = {
      pass: '#16a34a',
      fail: '#dc2626',
      skipped: '#6b7280',
      pending: '#d97706',
      uploaded: '#d97706',
      analyzing: '#d97706',
      error: '#dc2626',
    };

    const checklist = inspection.checklist ?? [];
    const THUMB_SIZE = 90;

    for (const section of [1, 2, 3]) {
      const entries = checklist.filter((c) => c.section === section);
      if (!entries.length) continue;

      if (doc.y > 680) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(SECTION_TITLES[section]);
      doc.moveDown(0.3);

      for (const entry of entries) {
        const meta = getChecklistItem(entry.itemId) ?? CHECKLIST_ITEMS.find((i) => i.id === entry.itemId);
        const title = meta?.title ?? entry.itemId.replace(/_/g, ' ');
        const label = STATUS_LABEL[entry.status] ?? entry.status.toUpperCase();
        const color = STATUS_COLOR[entry.status] ?? '#000';

        if (doc.y > 700) doc.addPage();
        const rowTop = doc.y;

        // Thumbnail (images only — PDFs can't play video)
        let textLeft = 50;
        if (entry.mediaUrl && entry.mediaType === 'image') {
          const diskPath = mediaUrlToDiskPath(entry.mediaUrl);
          try {
            if (fs.existsSync(diskPath)) {
              doc.image(diskPath, 50, rowTop, { fit: [THUMB_SIZE, THUMB_SIZE] });
              textLeft = 50 + THUMB_SIZE + 12;
            }
          } catch {
            // Corrupt/unreadable image — fall back to text-only row.
          }
        }

        doc
          .font('Helvetica-Bold')
          .fontSize(9)
          .fillColor('#000')
          .text(`${title} `, textLeft, rowTop, { continued: true, width: 545 - textLeft })
          .fillColor(color)
          .text(`[${label}]${entry.required ? '' : ' (optional)'}`);

        if (typeof entry.confidence === 'number') {
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#444')
            .text(`Confidence: ${Math.round(entry.confidence * 100)}%`, textLeft, doc.y, { width: 545 - textLeft });
        }
        if (entry.notes) {
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor('#444')
            .text(entry.notes, textLeft, doc.y, { width: 545 - textLeft });
        }
        if (entry.mediaType === 'video' && entry.mediaUrl) {
          doc
            .font('Helvetica-Oblique')
            .fontSize(8)
            .fillColor('#888')
            .text('Video captured — see platform for playback.', textLeft, doc.y, { width: 545 - textLeft });
        }

        doc.fillColor('#000');
        doc.y = Math.max(doc.y, rowTop + THUMB_SIZE) + 8;
      }
      doc.moveDown(0.3);
    }

    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke().moveDown(0.5);

    // ── Footer ───────────────────────────────────────────────────
    doc.fontSize(8).fillColor('#666').text(
      `Generated by AED Inspection Platform • ${new Date().toISOString()}`,
      { align: 'center' },
    );

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
