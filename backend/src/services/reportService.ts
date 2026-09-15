/**
 * Renders an inspection into a branded PDF report.
 *
 * This document is the artifact the customer keeps and hands to an auditor,
 * so it's laid out as a real report — brand header, result banner, device
 * spec grid, results table and a photo-evidence appendix — rather than a
 * dump of label/value lines.
 *
 * Shared by the download route (streams straight to the HTTP response) and
 * the email service (collects into a Buffer for attachment) so the layout
 * only lives in one place.
 */
import PDFDocument from 'pdfkit';
import path from 'path';
import fs from 'fs';
import { CHECKLIST_ITEMS, getChecklistItem } from '../config/checklist-items';
import { config } from '../config/env';

// ── Design tokens — mirrors the web app's palette ──────────────────────────
const COLOR = {
  ink: '#191b23',
  inkMuted: '#5a5f72',
  inkLight: '#8b8fa3',
  primary: '#33409e',
  onPrimary: '#c3c9e9',
  white: '#ffffff',
  line: '#e4e2de',
  lineSoft: '#f4f2ef',
  ok: '#1d7a4c',
  okTint: '#e7f5ec',
  warn: '#a15c05',
  warnTint: '#fbf0dd',
  bad: '#b0242a',
  badTint: '#fbeaea',
  neutral: '#6b7280',
  neutralTint: '#f1f1f0',
};

const PAGE = { width: 595.28, height: 841.89, margin: 45 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const HEADER_HEIGHT = 88;
/** Content must never run below this — the footer band lives underneath. */
const BODY_BOTTOM = PAGE.height - 52;
/** Continuation pages leave room for the running header. */
const CONTINUATION_TOP = PAGE.margin + 24;

const SECTION_TITLES: Record<number, string> = {
  1: 'Consumables & Identification',
  2: 'Physical Status',
  3: 'Accessories & Signage',
};

type Swatch = { color: string; tint: string; label: string };

function resultSwatch(result: string): Swatch {
  switch (result) {
    case 'PASS':
      return { color: COLOR.ok, tint: COLOR.okTint, label: 'PASS' };
    case 'FAIL':
      return { color: COLOR.bad, tint: COLOR.badTint, label: 'FAIL' };
    case 'REVIEW':
      return { color: COLOR.warn, tint: COLOR.warnTint, label: 'NEEDS REVIEW' };
    default:
      return { color: COLOR.neutral, tint: COLOR.neutralTint, label: 'INCOMPLETE' };
  }
}

function itemSwatch(status: string): Swatch {
  switch (status) {
    case 'pass':
      return { color: COLOR.ok, tint: COLOR.okTint, label: 'PASS' };
    case 'fail':
    case 'error':
      return { color: COLOR.bad, tint: COLOR.badTint, label: status === 'error' ? 'ERROR' : 'FAIL' };
    case 'skipped':
      return { color: COLOR.neutral, tint: COLOR.neutralTint, label: 'SKIPPED' };
    case 'uploaded':
    case 'analyzing':
      return { color: COLOR.warn, tint: COLOR.warnTint, label: 'PENDING' };
    default:
      return { color: COLOR.warn, tint: COLOR.warnTint, label: 'NOT DONE' };
  }
}

function mediaUrlToDiskPath(mediaUrl: string): string {
  return path.join(config.UPLOAD_DIR, mediaUrl.replace(/^\/uploads\//, ''));
}

function formatDate(value: unknown): string {
  if (!value) return 'Not recorded';
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Starts a fresh page, leaving headroom for the running header. */
function newPage(doc: PDFKit.PDFDocument): void {
  doc.addPage();
  doc.y = CONTINUATION_TOP;
}

/** Breaks to a new page when `needed` points of vertical space aren't left. */
function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > BODY_BOTTOM) newPage(doc);
}

/** The brand mark, drawn as vector paths — no image asset, scales cleanly. */
function drawLogo(doc: PDFKit.PDFDocument, x: number, y: number, size: number, color: string): void {
  const scale = size / 24;
  doc
    .save()
    .translate(x, y)
    .scale(scale)
    .path('M2 13h4.5l1.8-5 3.6 11 2.7-11 1.6 5H22')
    .lineWidth(2 / scale)
    .lineCap('round')
    .lineJoin('round')
    .strokeColor(color)
    .stroke()
    .restore();
}

function pill(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  swatch: Swatch,
  opts: { solid?: boolean; fontSize?: number } = {},
): number {
  const fontSize = opts.fontSize ?? 7.5;
  doc.font('Helvetica-Bold').fontSize(fontSize);
  const textWidth = doc.widthOfString(text, { characterSpacing: 0.4 });
  const width = textWidth + 14;
  const height = fontSize + 8;

  doc.roundedRect(x, y, width, height, height / 2).fill(opts.solid ? swatch.color : swatch.tint);
  doc
    .fillColor(opts.solid ? COLOR.white : swatch.color)
    .text(text, x + 7, y + (height - fontSize) / 2 + 0.5, { characterSpacing: 0.4, lineBreak: false });

  return width;
}

// ── Header band (first page only) ──────────────────────────────────────────
function drawHeaderBand(doc: PDFKit.PDFDocument): void {
  doc.rect(0, 0, PAGE.width, HEADER_HEIGHT).fill(COLOR.primary);

  drawLogo(doc, PAGE.margin, 30, 20, COLOR.white);
  doc
    .font('Helvetica-Bold')
    .fontSize(15)
    .fillColor(COLOR.white)
    .text('AED Inspect', PAGE.margin + 27, 31, { lineBreak: false });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLOR.onPrimary)
    .text('Automated AED inspection', PAGE.margin + 27, 48, { lineBreak: false });

  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLOR.white)
    .text('INSPECTION REPORT', PAGE.margin, 36, {
      width: CONTENT_WIDTH,
      align: 'right',
      characterSpacing: 1.2,
      lineBreak: false,
    });
  doc
    .font('Helvetica')
    .fontSize(8)
    .fillColor(COLOR.onPrimary)
    .text('Think Healthcare and Safety', PAGE.margin, 50, {
      width: CONTENT_WIDTH,
      align: 'right',
      lineBreak: false,
    });

  doc.y = HEADER_HEIGHT + 24;
}

// ── Result banner ──────────────────────────────────────────────────────────
function drawResultBanner(doc: PDFKit.PDFDocument, inspection: Record<string, any>): void {
  const swatch = resultSwatch(inspection.inspectionResult);
  const checklist: any[] = inspection.checklist ?? [];
  const required = checklist.filter((c) => c.required);
  const passed = required.filter((c) => c.status === 'pass').length;

  const top = doc.y;
  const height = 58;

  doc.roundedRect(PAGE.margin, top, CONTENT_WIDTH, height, 8).fill(swatch.tint);
  doc.rect(PAGE.margin, top, 4, height).fill(swatch.color);

  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor(swatch.color)
    .text(swatch.label, PAGE.margin + 20, top + 13, { lineBreak: false });

  doc
    .font('Helvetica')
    .fontSize(8.5)
    .fillColor(COLOR.inkMuted)
    .text(
      `${passed} of ${required.length} required checks passed${
        inspection.aedModel ? ` · ${inspection.aedModel}` : ''
      }`,
      PAGE.margin + 20,
      top + 37,
      { lineBreak: false },
    );

  doc
    .font('Helvetica')
    .fontSize(7.5)
    .fillColor(COLOR.inkLight)
    .text('INSPECTED', PAGE.margin, top + 16, {
      width: CONTENT_WIDTH - 20,
      align: 'right',
      characterSpacing: 0.8,
      lineBreak: false,
    });
  doc
    .font('Helvetica-Bold')
    .fontSize(9.5)
    .fillColor(COLOR.ink)
    .text(formatDate(inspection.startedAt), PAGE.margin, top + 28, {
      width: CONTENT_WIDTH - 20,
      align: 'right',
      lineBreak: false,
    });

  doc.y = top + height + 26;
}

function drawSectionLabel(doc: PDFKit.PDFDocument, text: string): void {
  ensureSpace(doc, 34);
  doc
    .font('Helvetica-Bold')
    .fontSize(8)
    .fillColor(COLOR.primary)
    .text(text.toUpperCase(), PAGE.margin, doc.y, { characterSpacing: 1, lineBreak: false });
  const y = doc.y + 12;
  doc.moveTo(PAGE.margin, y).lineTo(PAGE.margin + CONTENT_WIDTH, y).lineWidth(0.8).strokeColor(COLOR.line).stroke();
  doc.y = y + 12;
}

// ── Device / inspection detail grid ────────────────────────────────────────
function drawDetailGrid(doc: PDFKit.PDFDocument, pairs: [string, string][]): void {
  const gutter = 18;
  const colWidth = (CONTENT_WIDTH - gutter) / 2;
  const rowHeight = 32;

  for (let i = 0; i < pairs.length; i += 2) {
    ensureSpace(doc, rowHeight);
    const top = doc.y;

    for (let c = 0; c < 2; c++) {
      const pair = pairs[i + c];
      if (!pair) continue;
      const x = PAGE.margin + c * (colWidth + gutter);

      doc
        .font('Helvetica')
        .fontSize(6.8)
        .fillColor(COLOR.inkLight)
        .text(pair[0].toUpperCase(), x, top, { width: colWidth, characterSpacing: 0.7, lineBreak: false });
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(COLOR.ink)
        .text(pair[1], x, top + 11, { width: colWidth, ellipsis: true, lineBreak: false });
    }

    const bottom = top + rowHeight;
    if (i + 2 < pairs.length) {
      doc
        .moveTo(PAGE.margin, bottom - 8)
        .lineTo(PAGE.margin + CONTENT_WIDTH, bottom - 8)
        .lineWidth(0.5)
        .strokeColor(COLOR.lineSoft)
        .stroke();
    }
    doc.y = bottom;
  }

  doc.y += 14;
}

// ── Checklist results table ────────────────────────────────────────────────
function drawChecklistTable(doc: PDFKit.PDFDocument, inspection: Record<string, any>): void {
  const checklist: any[] = inspection.checklist ?? [];
  const statusColX = PAGE.margin + CONTENT_WIDTH - 78;
  const textWidth = statusColX - PAGE.margin - 16;

  for (const section of [1, 2, 3]) {
    const entries = checklist.filter((c) => c.section === section);
    if (!entries.length) continue;

    ensureSpace(doc, 40);
    doc
      .font('Helvetica-Bold')
      .fontSize(8.5)
      .fillColor(COLOR.ink)
      .text(`${section}. ${SECTION_TITLES[section]}`, PAGE.margin, doc.y, { lineBreak: false });
    doc.y += 16;

    entries.forEach((entry, idx) => {
      const meta = getChecklistItem(entry.itemId) ?? CHECKLIST_ITEMS.find((i) => i.id === entry.itemId);
      const title = meta?.title ?? entry.itemId.replace(/_/g, ' ');
      const swatch = itemSwatch(entry.status);

      const notes: string = entry.notes ?? '';
      const notesHeight = notes
        ? Math.min(doc.font('Helvetica').fontSize(7.5).heightOfString(notes, { width: textWidth }), 19)
        : 0;
      const rowHeight = 22 + notesHeight;

      ensureSpace(doc, rowHeight + 4);
      const top = doc.y;

      if (idx % 2 === 1) {
        doc.rect(PAGE.margin, top - 3, CONTENT_WIDTH, rowHeight).fill(COLOR.lineSoft);
      }

      doc
        .font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(COLOR.ink)
        .text(title, PAGE.margin + 8, top + 1, { width: textWidth, ellipsis: true, lineBreak: false });

      if (!meta?.required) {
        const titleWidth = doc.font('Helvetica-Bold').fontSize(9).widthOfString(title);
        doc
          .font('Helvetica')
          .fontSize(6.5)
          .fillColor(COLOR.inkLight)
          .text('OPTIONAL', PAGE.margin + 12 + Math.min(titleWidth, textWidth - 46), top + 3, {
            characterSpacing: 0.5,
            lineBreak: false,
          });
      }

      if (notes) {
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(COLOR.inkMuted)
          .text(notes, PAGE.margin + 8, top + 13, { width: textWidth, height: notesHeight, ellipsis: true });
      }

      pill(doc, swatch.label, statusColX, top, swatch);

      if (typeof entry.confidence === 'number') {
        doc
          .font('Helvetica')
          .fontSize(7)
          .fillColor(COLOR.inkLight)
          .text(`${Math.round(entry.confidence * 100)}% confidence`, statusColX, top + 15, {
            width: 78,
            lineBreak: false,
          });
      }

      doc.y = top + rowHeight;
    });

    doc.y += 10;
  }

  doc.y += 4;
}

// ── Photo evidence appendix ────────────────────────────────────────────────
function drawEvidence(doc: PDFKit.PDFDocument, inspection: Record<string, any>): void {
  const checklist: any[] = inspection.checklist ?? [];
  const captured = checklist.filter((c) => c.mediaUrl);
  if (!captured.length) return;

  ensureSpace(doc, 60);
  drawSectionLabel(doc, 'Photo evidence');

  const cols = 3;
  const gutter = 14;
  const cellWidth = (CONTENT_WIDTH - gutter * (cols - 1)) / cols;
  const imageHeight = cellWidth * 0.75;
  const cellHeight = imageHeight + 34;

  for (let i = 0; i < captured.length; i += cols) {
    ensureSpace(doc, cellHeight);
    const top = doc.y;

    for (let c = 0; c < cols; c++) {
      const entry = captured[i + c];
      if (!entry) continue;

      const x = PAGE.margin + c * (cellWidth + gutter);
      const meta = getChecklistItem(entry.itemId) ?? CHECKLIST_ITEMS.find((it) => it.id === entry.itemId);
      const title = meta?.title ?? entry.itemId.replace(/_/g, ' ');
      const swatch = itemSwatch(entry.status);

      doc.roundedRect(x, top, cellWidth, imageHeight, 5).fill(COLOR.lineSoft);

      let drawn = false;
      if (entry.mediaType === 'image') {
        const diskPath = mediaUrlToDiskPath(entry.mediaUrl);
        try {
          if (fs.existsSync(diskPath)) {
            doc.save();
            doc.roundedRect(x, top, cellWidth, imageHeight, 5).clip();
            doc.image(diskPath, x, top, { cover: [cellWidth, imageHeight], align: 'center', valign: 'center' });
            doc.restore();
            drawn = true;
          }
        } catch {
          // Corrupt or unreadable image — fall through to the placeholder.
        }
      }

      if (!drawn) {
        doc
          .font('Helvetica')
          .fontSize(7.5)
          .fillColor(COLOR.inkLight)
          .text(
            entry.mediaType === 'video' ? 'Video captured\nview in platform' : 'Photo unavailable',
            x,
            top + imageHeight / 2 - 10,
            { width: cellWidth, align: 'center' },
          );
      }

      doc
        .roundedRect(x, top, cellWidth, imageHeight, 5)
        .lineWidth(0.6)
        .strokeColor(COLOR.line)
        .stroke();

      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLOR.ink)
        .text(title, x, top + imageHeight + 7, { width: cellWidth - 34, ellipsis: true, lineBreak: false });

      pill(doc, swatch.label, x + cellWidth - 32, top + imageHeight + 5, swatch, { fontSize: 6 });
    }

    doc.y = top + cellHeight;
  }
}

// ── Footer + running header, drawn across all pages at the end ─────────────
function drawPageFurniture(doc: PDFKit.PDFDocument, inspection: Record<string, any>): void {
  const range = doc.bufferedPageRange();
  const generated = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);

    // The footer deliberately sits below the text-body bottom margin. Without
    // this, PDFKit treats drawing there as an overflow and helpfully appends a
    // blank page — once per page, each carrying an orphaned page number.
    doc.page.margins.bottom = 0;

    // Running header on continuation pages only — page 1 has the brand band.
    if (i > 0) {
      drawLogo(doc, PAGE.margin, PAGE.margin - 12, 11, COLOR.primary);
      doc
        .font('Helvetica-Bold')
        .fontSize(8)
        .fillColor(COLOR.ink)
        .text('AED Inspection Report', PAGE.margin + 16, PAGE.margin - 11, { lineBreak: false });
      doc
        .font('Helvetica')
        .fontSize(7.5)
        .fillColor(COLOR.inkLight)
        .text(inspection.serialNumber ? `Serial ${inspection.serialNumber}` : inspection.aedModel ?? '', PAGE.margin, PAGE.margin - 11, {
          width: CONTENT_WIDTH,
          align: 'right',
          lineBreak: false,
        });
      doc
        .moveTo(PAGE.margin, PAGE.margin + 4)
        .lineTo(PAGE.margin + CONTENT_WIDTH, PAGE.margin + 4)
        .lineWidth(0.6)
        .strokeColor(COLOR.line)
        .stroke();
    }

    const footerY = PAGE.height - 38;
    doc
      .moveTo(PAGE.margin, footerY)
      .lineTo(PAGE.margin + CONTENT_WIDTH, footerY)
      .lineWidth(0.6)
      .strokeColor(COLOR.line)
      .stroke();

    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLOR.inkLight)
      .text('Powered by Think Healthcare and Safety · inspector.aedsmartx.com', PAGE.margin, footerY + 9, {
        lineBreak: false,
      });
    doc
      .font('Helvetica')
      .fontSize(7)
      .fillColor(COLOR.inkLight)
      .text(`Generated ${generated}`, PAGE.margin, footerY + 19, { lineBreak: false });
    doc
      .font('Helvetica-Bold')
      .fontSize(7.5)
      .fillColor(COLOR.inkMuted)
      .text(`Page ${i + 1} of ${range.count}`, PAGE.margin + CONTENT_WIDTH - 60, footerY + 13, {
        width: 60,
        align: 'right',
        lineBreak: false,
      });
  }
}

/** A PDFDocument configured for this report — buffered so footers can be
 *  stamped across every page once the total page count is known. */
export function createReportDoc(): PDFKit.PDFDocument {
  return new PDFDocument({ size: 'A4', margin: PAGE.margin, bufferPages: true });
}

/** Writes the full report into a document from createReportDoc(). The caller
 *  owns piping and calling .end(). */
export function renderInspectionPdf(doc: PDFKit.PDFDocument, inspection: Record<string, any>): void {
  const inspectorName = inspection.guestName ?? inspection.inspector?.name ?? 'Unknown';
  const inspectorEmail = inspection.guestEmail ?? inspection.inspector?.email;
  const batteryLot = [inspection.batteryLot, inspection.batterySerialNumber].filter(Boolean).join(' / ');

  drawHeaderBand(doc);
  drawResultBanner(doc, inspection);

  drawSectionLabel(doc, 'Device details');
  drawDetailGrid(doc, [
    ['AED model', inspection.aedModel ?? 'Not specified'],
    ['Serial number', inspection.serialNumber ?? 'Not captured'],
    ['Pads expiry', inspection.padsExpiry ?? 'Not captured'],
    ['Battery expiry', inspection.batteryExpiry ?? 'Not captured'],
    ['Battery lot / serial', batteryLot || 'Not captured'],
    ['Readiness indicator', inspection.statusIndicator ?? 'Not checked'],
  ]);

  drawSectionLabel(doc, 'Inspection details');
  drawDetailGrid(doc, [
    ['Inspected by', inspectorName],
    ['Contact', inspectorEmail ?? 'Not provided'],
    ['Phone', inspection.guestPhone ?? 'Not provided'],
    ['Location', inspection.locationId ?? 'Not specified'],
    ['Duration', inspection.durationSeconds ? `${Math.round(inspection.durationSeconds)} seconds` : 'Not recorded'],
    ['Inspection ID', inspection.inspectionId],
  ]);

  drawSectionLabel(doc, 'Checklist results');
  drawChecklistTable(doc, inspection);

  drawEvidence(doc, inspection);

  drawPageFurniture(doc, inspection);
}

/** Renders the report into an in-memory Buffer (for email attachments). */
export function generateInspectionPdfBuffer(inspection: Record<string, any>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = createReportDoc();
      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      renderInspectionPdf(doc, inspection);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
