/**
 * Renders the sample report shown on the landing page ("See a sample").
 *
 * It goes through the same renderer as every customer's report, so the
 * sample can never promise more than the real thing delivers. Change the
 * report, then re-run this and re-export the page images:
 *
 *   (from backend/)
 *   node -r ./node_modules/ts-node-dev/node_modules/ts-node/register/transpile-only src/scripts/sample-report.ts
 *
 * then render each page of the PDF at 150 dpi (PyMuPDF: page.get_pixmap(dpi=150))
 * and save them as page-1.webp, page-2.webp… in frontend/public/sample-report/.
 *
 * The captures in sample-captures/ are close-ups cropped from the site's own
 * reference photos of a Philips HeartStart HS1. The stock pads cartridge
 * expired in 2019, so its label was re-dated to 2026/11 using the label's
 * own printed digits. The inspection is fictional and the report says so.
 */
import fs from 'fs';
import path from 'path';

// Read by the config module on import, so set before the renderer loads.
process.env.UPLOAD_DIR ??= path.join(__dirname, 'sample-captures');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createReportDoc, renderInspectionPdf } = require('../services/reportService') as typeof import('../services/reportService');

const out =
  process.argv[2] ??
  path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'sample-report', 'aed-inspect-sample-report.pdf');
fs.mkdirSync(path.dirname(out), { recursive: true });

const startedAt = new Date('2026-09-28T10:14:00+05:30');
const completedAt = new Date(startedAt.getTime() + 192_000);

type Item = {
  itemId: string;
  section: 1 | 2 | 3;
  required: boolean;
  status: string;
  mediaType?: 'image' | 'video';
  confidence?: number;
  notes?: string;
  aiData?: Record<string, unknown>;
};

function captured(
  itemId: string,
  section: 1 | 2 | 3,
  required: boolean,
  confidence: number,
  notes: string,
  aiData: Record<string, unknown> = {},
  mediaType: 'image' | 'video' = 'image',
): Item & { mediaUrl: string } {
  return {
    itemId,
    section,
    required,
    status: 'pass',
    mediaType,
    mediaUrl: `/uploads/sample/${itemId}.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
    confidence,
    notes,
    aiData: { passed: true, confidence, notes, ...aiData },
  };
}

export const SAMPLE_INSPECTION = {
  inspectionId: '7c1e4a92-5b3d-4f08-9e6a-2d8b0c5f1a37',
  aedModel: 'Philips HS1',
  guestName: 'Priya Sharma',
  guestEmail: 'priya.sharma@example.com',
  guestPhone: '+919876543210',
  inspectionStatus: 'complete',
  inspectionResult: 'PASS',
  startedAt,
  completedAt,
  durationSeconds: 192,
  serialNumber: 'A18A-06336',
  padsExpiry: '2026-11',
  batteryExpiry: '2028-12',
  statusIndicator: 'ready',
  checklist: [
    captured('serial_number', 1, true, 0.97, 'Serial number read clearly from the SN label on the back panel.', {
      serial_number: 'A18A-06336',
    }),
    captured('pads_expiry', 1, true, 0.95, 'Pads cartridge expiry date is 2026/11, beside the hourglass symbol.', {
      expiry_date: '2026-11',
    }),
    captured('battery_expiry', 1, true, 0.93, 'Battery label shows an install-before date of 2028-12-31.', {
      expiry_date: '2028-12',
    }),
    captured('battery_attached', 2, true, 0.94, 'Battery is pushed fully in and sits flush with the case.'),
    captured('pads_connected', 2, true, 0.92, 'Pads cartridge is fitted in the front well, green PULL handle down.'),
    captured(
      'readiness_indicator',
      2,
      true,
      0.9,
      'Green Ready light seen blinking at a steady interval; no fault indicators.',
      { status: 'ready' },
      'video',
    ),
    { itemId: 'child_key_pad', section: 3, required: false, status: 'pending' },
    captured('aed_cabinet', 3, false, 0.9, 'Cabinet door closed and AED signage clearly visible.'),
    captured('first_response_kit', 3, false, 0.88, 'Kit holds gloves, a razor, scissors and a CPR face shield.'),
    { itemId: 'emergency_contacts', section: 3, required: false, status: 'pending' },
  ],
};

const doc = createReportDoc();
doc.pipe(fs.createWriteStream(out));
renderInspectionPdf(doc, SAMPLE_INSPECTION, { sample: true, generatedAt: completedAt });
doc.end();
console.log(`wrote ${out}`);
