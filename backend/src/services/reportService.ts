/**
 * Renders an inspection into a branded PDF report.
 *
 * This document is the artifact the customer keeps and hands to an auditor,
 * so it reads top-down the way they do: the verdict, what to do next, the
 * device and who inspected it, then every check with its own photo, what
 * the AI read off it and the result — evidence beside the claim, rather than
 * a results table and a separate photo appendix to cross-reference.
 *
 * Shared by the download route (streams straight to the HTTP response), the
 * email service (collects into a Buffer for attachment) and the landing
 * page's sample (src/scripts/sample-report.ts), so the layout only lives in
 * one place and the sample can never promise more than the real thing.
 */
import PDFDocument from 'pdfkit';
import { deviceAge } from '../utils/device-age';
import { MAX_SCORE, READY_THRESHOLD, readinessScore } from '../config/scoring';
import path from 'path';
import fs from 'fs';
import { CHECKLIST_ITEMS, getChecklistItem } from '../config/checklist-items';
import { config } from '../config/env';
import { daysUntil, describeExpiry, formatExpiryLabel, toExpiryDate, urgencyOf } from '../utils/expiry';

// ── Design tokens — mirrors the web app's palette ──────────────────────────
const COLOR = {
  ink: '#191b23',
  inkMuted: '#5a5f72',
  inkLight: '#8b8fa3',
  primary: '#33409e',
  primaryTint: '#eef0f9',
  white: '#ffffff',
  line: '#e4e2de',
  lineSoft: '#f0eeea',
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
const RIGHT_EDGE = PAGE.margin + CONTENT_WIDTH;
const HEADER_HEIGHT = 80;
/** Content must never run below this — the footer band lives underneath. */
const BODY_BOTTOM = PAGE.height - 52;
/** Continuation pages leave room for the running header. */
const CONTINUATION_TOP = PAGE.margin + 26;

const SECTION_TITLES: Record<number, string> = {
  1: 'Quick check: readiness & identity',
  2: 'Consumables & connections',
  3: 'Accessories & signage',
};

/** Finished after the quick check — the readiness indicator and serial. */
function isQuick(ctx: Ctx): boolean {
  return ctx.inspection.scope === 'quick';
}

const MODEL_NAMES: Record<string, string> = {
  'Philips FRx': 'Philips HeartStart FRx',
  'Philips HS1': 'Philips HeartStart HS1',
  'Zoll AED Plus': 'ZOLL AED Plus',
  'Zoll AED 3': 'ZOLL AED 3',
  'Zoll Powerheart G3': 'Cardiac Science (ZOLL) Powerheart G3',
  'Zoll Powerheart G5': 'Cardiac Science (ZOLL) Powerheart G5',
  'Defibtech Lifeline': 'Defibtech Lifeline AED (semi-automatic)',
  'Defibtech Lifeline AUTO': 'Defibtech Lifeline AUTO AED (fully automatic)',
  'Defibtech Lifeline VIEW': 'Defibtech Lifeline VIEW AED',
  'Defibtech Lifeline ECG': 'Defibtech Lifeline ECG AED',
};

/** How often a routine visual check is suggested after this one. */
const NEXT_CHECK_DAYS = 30;
/** Consumables inside this window get an "order ahead" step — the same 90
 *  days the result screen and the sales pipeline call "soon". */
const REPLACEMENT_WINDOW_DAYS = 90;

// ── Type ───────────────────────────────────────────────────────────────────
// Geist, the web app's own typeface, so the report and the screen it came
// from look like one product. Falls back to the PDF built-ins if the files
// are ever missing, so a packaging slip can't stop reports going out.
const FONT_DIR = path.join(__dirname, '..', '..', 'assets', 'fonts');
const FONT_FILES = {
  regular: 'Geist-Regular.ttf',
  medium: 'Geist-Medium.ttf',
  semibold: 'Geist-SemiBold.ttf',
  bold: 'Geist-Bold.ttf',
  mono: 'GeistMono-Medium.ttf',
} as const;
type Face = keyof typeof FONT_FILES;
const BUILT_IN: Record<Face, string> = {
  regular: 'Helvetica',
  medium: 'Helvetica',
  semibold: 'Helvetica-Bold',
  bold: 'Helvetica-Bold',
  mono: 'Courier-Bold',
};
const FACE: Record<Face, string> = { ...BUILT_IN };

function registerFonts(doc: PDFKit.PDFDocument): void {
  for (const face of Object.keys(FONT_FILES) as Face[]) {
    const file = path.join(FONT_DIR, FONT_FILES[face]);
    if (fs.existsSync(file)) {
      doc.registerFont(`report-${face}`, file);
      FACE[face] = `report-${face}`;
    } else {
      FACE[face] = BUILT_IN[face];
    }
  }
}

function font(doc: PDFKit.PDFDocument, face: Face, size: number, color: string): PDFKit.PDFDocument {
  return doc.font(FACE[face]).fontSize(size).fillColor(color);
}

// ── Dates ──────────────────────────────────────────────────────────────────
// Times are shown in the customers' own zone (the server runs on UTC), and
// say which zone they are in.
function zoneLabel(date: Date): string {
  try {
    return (
      new Intl.DateTimeFormat('en-IN', { timeZone: config.REPORT_TIMEZONE, timeZoneName: 'short' })
        .formatToParts(date)
        .find((p) => p.type === 'timeZoneName')?.value ?? ''
    );
  } catch {
    return '';
  }
}

function formatDateTime(value: unknown): string {
  if (!value) return 'Not recorded';
  const date = new Date(value as string);
  if (Number.isNaN(date.getTime())) return String(value);
  const text = date.toLocaleString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: config.REPORT_TIMEZONE,
  });
  const zone = zoneLabel(date);
  return zone ? `${text} ${zone}` : text;
}

function formatDay(date: Date): string {
  return date.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: config.REPORT_TIMEZONE,
  });
}

/** Stored as "+919876543210"; printed the way it's read aloud. */
function formatPhone(raw: string): string {
  const india = /^\+91(\d{5})(\d{5})$/.exec(raw.replace(/\s/g, ''));
  return india ? `+91 ${india[1]} ${india[2]}` : raw;
}

function formatDuration(seconds?: number): string | undefined {
  if (!seconds || seconds <= 0) return undefined;
  const s = Math.round(seconds);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
}

// ── Reading the inspection ─────────────────────────────────────────────────
type Swatch = { color: string; tint: string; label: string };
type Entry = Record<string, any>;

interface Ctx {
  inspection: Record<string, any>;
  checklist: Entry[];
  /** The moment the report speaks from: expiry countdowns and the next
   *  check are counted from the inspection, not from whenever it's opened. */
  asOf: Date;
  model: string;
  shortId: string;
  sample: boolean;
  generatedAt: Date;
}

function itemMeta(entry: Entry) {
  return getChecklistItem(entry.itemId) ?? CHECKLIST_ITEMS.find((i) => i.id === entry.itemId);
}

function itemTitle(entry: Entry): string {
  return itemMeta(entry)?.title ?? String(entry.itemId).replace(/_/g, ' ');
}

function itemSwatch(status: string): Swatch {
  switch (status) {
    case 'pass':
      return { color: COLOR.ok, tint: COLOR.okTint, label: 'PASS' };
    case 'fail':
      return { color: COLOR.bad, tint: COLOR.badTint, label: 'FAIL' };
    case 'error':
      return { color: COLOR.bad, tint: COLOR.badTint, label: 'NOT READ' };
    case 'skipped':
      return { color: COLOR.neutral, tint: COLOR.neutralTint, label: 'SKIPPED' };
    case 'uploaded':
    case 'analyzing':
      return { color: COLOR.warn, tint: COLOR.warnTint, label: 'PENDING' };
    default:
      return { color: COLOR.warn, tint: COLOR.warnTint, label: 'NOT DONE' };
  }
}

const URGENCY_COLOR = { expired: COLOR.bad, critical: COLOR.warn, soon: COLOR.warn, ok: COLOR.ok };

interface Expiry {
  label: string;
  /** Printed to the day ("on 15 Oct 2026") rather than the month ("in Nov 2026"). */
  exact: boolean;
  days: number;
  describe: string;
  color: string;
}

function expiryOf(raw: unknown, asOf: Date): Expiry | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const at = toExpiryDate(raw);
  if (!at) return { label: raw, exact: false, days: Number.NaN, describe: '', color: COLOR.inkMuted };
  const days = daysUntil(at, asOf);
  return {
    label: formatExpiryLabel(raw),
    exact: /^\d{4}-\d{2}-\d{2}$/.test(raw.trim()),
    days,
    describe: describeExpiry(days),
    color: URGENCY_COLOR[urgencyOf(days)],
  };
}

const STATUS_WORD: Record<string, { text: string; color: string }> = {
  ready: { text: 'Ready', color: COLOR.ok },
  fault: { text: 'Fault', color: COLOR.bad },
  unclear: { text: 'Unclear', color: COLOR.warn },
};

/** What the AI read off a capture, as it should be shown back. */
function readingOf(entry: Entry, asOf: Date): { text: string; mono?: boolean; sub?: Expiry } | undefined {
  const ai = (entry.aiData ?? {}) as Record<string, unknown>;
  if (typeof ai.serial_number === 'string' && ai.serial_number.trim()) {
    return { text: ai.serial_number.trim(), mono: true };
  }
  const expiry = expiryOf(ai.expiry_date, asOf);
  if (expiry) return { text: expiry.label, sub: expiry.describe ? expiry : undefined };
  if (entry.itemId === 'readiness_indicator' && typeof ai.status === 'string') {
    const word = STATUS_WORD[ai.status.toLowerCase()];
    if (word) return { text: word.text };
  }
  return undefined;
}

function consumableExpiry(ctx: Ctx, itemId: 'pads_expiry' | 'battery_expiry'): Expiry | undefined {
  const entry = ctx.checklist.find((c) => c.itemId === itemId);
  const raw = entry?.aiData?.expiry_date ?? (itemId === 'pads_expiry' ? ctx.inspection.padsExpiry : ctx.inspection.batteryExpiry);
  return expiryOf(raw, ctx.asOf);
}

/** Required checks, plus optional extras that were actually done. An
 *  optional check nobody attempted isn't a finding, and listing it as "not
 *  done" made a clean pass look unfinished. */
function reportedEntries(ctx: Ctx): Entry[] {
  const done = (c: Entry) => ['pass', 'fail', 'skipped'].includes(c.status);
  return ctx.checklist.filter((c) => (isQuick(ctx) ? done(c) : c.required || done(c)));
}

// ── Drawing primitives ─────────────────────────────────────────────────────
function newPage(doc: PDFKit.PDFDocument): void {
  doc.addPage();
  doc.y = CONTINUATION_TOP;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > BODY_BOTTOM) newPage(doc);
}

function pillWidth(doc: PDFKit.PDFDocument, text: string, fontSize: number): number {
  font(doc, 'semibold', fontSize, COLOR.ink);
  return doc.widthOfString(text, { characterSpacing: 0.5 }) + 14;
}

function pill(doc: PDFKit.PDFDocument, text: string, x: number, y: number, swatch: Swatch, fontSize = 7): number {
  const width = pillWidth(doc, text, fontSize);
  const height = fontSize + 8;
  doc.roundedRect(x, y, width, height, height / 2).fill(swatch.tint);
  font(doc, 'semibold', fontSize, swatch.color).text(text, x + 7, y + 4.2, { characterSpacing: 0.5, lineBreak: false });
  return width;
}

function drawSectionLabel(doc: PDFKit.PDFDocument, text: string): void {
  ensureSpace(doc, 40);
  font(doc, 'semibold', 7.5, COLOR.primary).text(text.toUpperCase(), PAGE.margin, doc.y, {
    characterSpacing: 1.1,
    lineBreak: false,
  });
  const y = doc.y + 13;
  doc.moveTo(PAGE.margin, y).lineTo(RIGHT_EDGE, y).lineWidth(0.7).strokeColor(COLOR.line).stroke();
  doc.y = y + 13;
}

// ── Brand ──────────────────────────────────────────────────────────────────
// The site is inspector.aedsmartx.com: this is aedsmartx's Inspector, and
// aedsmartx is a Think Health product. The wordmark is the brand's own
// artwork (cut from aedsmartx.com); its three round letters are red, orange
// and green, which the letterhead repeats as a thin rule.
const BRAND = {
  wordmark: path.join(__dirname, '..', '..', 'assets', 'brand', 'aedsmartx.png'),
  red: '#ff3131',
  orange: '#ff914d',
  green: '#7ed957',
};

/** Draws the aedsmartx wordmark `height` points tall; returns its width. */
function drawWordmark(doc: PDFKit.PDFDocument, x: number, y: number, height: number): number {
  if (fs.existsSync(BRAND.wordmark)) {
    try {
      const img = (doc as any).openImage(BRAND.wordmark) as { width: number; height: number };
      const width = (img.width / img.height) * height;
      doc.image(img as any, x, y, { height });
      return width;
    } catch {
      // Fall through to the name in type.
    }
  }
  font(doc, 'bold', height * 1.05, COLOR.ink).text('aedsmartx', x, y - height * 0.12, { lineBreak: false });
  return doc.widthOfString('aedsmartx');
}

/** "aedsmartx | Inspector", as on the website. */
function drawLockup(doc: PDFKit.PDFDocument, x: number, y: number, height: number, size: number): void {
  const w = drawWordmark(doc, x, y, height);
  const gap = height * 0.55;
  doc
    .moveTo(x + w + gap, y + height * 0.05)
    .lineTo(x + w + gap, y + height * 0.95)
    .lineWidth(0.7)
    .strokeColor(COLOR.line)
    .stroke();
  font(doc, 'semibold', size, COLOR.ink).text('Inspector', x + w + gap * 2, y + height / 2 - size * 0.62, {
    lineBreak: false,
  });
}

// ── Letterhead (first page only) ───────────────────────────────────────────
function drawHeaderBand(doc: PDFKit.PDFDocument, ctx: Ctx): void {
  // The brand's three colours as a hairline across the top edge.
  const third = PAGE.width / 3;
  doc.rect(0, 0, third, 3).fill(BRAND.red);
  doc.rect(third, 0, third, 3).fill(BRAND.orange);
  doc.rect(third * 2, 0, PAGE.width - third * 2, 3).fill(BRAND.green);

  drawLockup(doc, PAGE.margin, 30, 17, 13);
  font(doc, 'regular', 8, COLOR.inkLight).text(isQuick(ctx) ? 'AED quick check report' : 'AED inspection report', PAGE.margin, 54, {
    lineBreak: false,
  });

  if (ctx.sample) {
    const label = 'SAMPLE REPORT';
    font(doc, 'semibold', 7.5, COLOR.primary);
    const width = doc.widthOfString(label, { characterSpacing: 1 }) + 18;
    doc.roundedRect(RIGHT_EDGE - width, 28, width, 18, 9).fill(COLOR.primaryTint);
    font(doc, 'semibold', 7.5, COLOR.primary).text(label, RIGHT_EDGE - width + 9, 33.5, {
      characterSpacing: 1,
      lineBreak: false,
    });
    font(doc, 'regular', 8, COLOR.inkLight).text('A fictional inspection, for illustration', PAGE.margin, 54, {
      width: CONTENT_WIDTH,
      align: 'right',
      lineBreak: false,
    });
  } else {
    font(doc, 'semibold', 10, COLOR.ink).text(`Report ${ctx.shortId}`, PAGE.margin, 31, {
      width: CONTENT_WIDTH,
      align: 'right',
      lineBreak: false,
    });
    font(doc, 'regular', 8, COLOR.inkLight).text('A Think Health™ product', PAGE.margin, 54, {
      width: CONTENT_WIDTH,
      align: 'right',
      lineBreak: false,
    });
  }

  doc
    .moveTo(PAGE.margin, HEADER_HEIGHT)
    .lineTo(RIGHT_EDGE, HEADER_HEIGHT)
    .lineWidth(0.7)
    .strokeColor(COLOR.line)
    .stroke();
  doc.y = HEADER_HEIGHT + 22;
}

// ── Verdict ────────────────────────────────────────────────────────────────
function verdictOf(ctx: Ctx): Swatch & { title: string; detail: string } {
  const required = ctx.checklist.filter((c) => c.required);
  const n = required.length;
  const failed = required.filter((c) => c.status === 'fail').length;
  const done = required.filter((c) => c.status === 'pass' || c.status === 'fail').length;
  const model = ctx.model;
  const score = readinessScore(ctx.checklist);
  const marks = `Readiness score ${score}/${MAX_SCORE}`;
  if (isQuick(ctx)) {
    const ready = ctx.inspection.inspectionResult === 'PASS';
    return {
      color: ready ? COLOR.ok : COLOR.bad,
      tint: ready ? COLOR.okTint : COLOR.badTint,
      label: ready ? 'PASS · QUICK CHECK' : 'FAIL · QUICK CHECK',
      title: ready ? 'Ready for use' : 'Not ready for use',
      detail: ready
        ? `The readiness indicator shows ready · Quick check: pads, battery and accessories not checked · ${model}`
        : `The readiness indicator does not show ready · Quick check · ${model}`,
    };
  }
  switch (ctx.inspection.inspectionResult) {
    case 'PASS':
      return {
        color: COLOR.ok,
        tint: COLOR.okTint,
        label: 'PASS',
        title: 'Ready for use',
        detail: `${marks} · All safety checks passed · ${model}`,
      };
    case 'FAIL':
      return {
        color: COLOR.bad,
        tint: COLOR.badTint,
        label: 'FAIL',
        title: score < READY_THRESHOLD ? 'Fails readiness' : 'Not ready for use',
        detail:
          score < READY_THRESHOLD
            ? `${marks}, below the ${READY_THRESHOLD} needed · ${failed} of ${n} required checks failed · ${model}`
            : `${marks}, but a safety check failed · ${model}`,
      };
    case 'REVIEW':
      return {
        color: COLOR.warn,
        tint: COLOR.warnTint,
        label: 'NEEDS REVIEW',
        title: 'Needs a closer look',
        detail: `Some checks couldn't be confirmed from the photos · ${model}`,
      };
    default:
      return {
        color: COLOR.neutral,
        tint: COLOR.neutralTint,
        label: 'INCOMPLETE',
        title: 'Inspection incomplete',
        detail: `${done} of ${n} required checks done · ${model}`,
      };
  }
}

function drawVerdictMark(doc: PDFKit.PDFDocument, result: string, cx: number, cy: number, color: string): void {
  const r = 17;
  doc.circle(cx, cy, r).fill(color);
  if (result === 'PASS') {
    doc
      .save()
      .translate(cx - 10, cy - 10)
      .scale(20 / 24)
      .path('M5 12.5l4.5 4.5L19 7.5')
      .lineWidth(3)
      .lineCap('round')
      .lineJoin('round')
      .strokeColor(COLOR.white)
      .stroke()
      .restore();
  } else {
    const glyph = result === 'FAIL' ? '!' : result === 'REVIEW' ? '?' : '–';
    font(doc, 'bold', 18, COLOR.white).text(glyph, cx - r, cy - 11.5, { width: r * 2, align: 'center', lineBreak: false });
  }
}

function drawVerdict(doc: PDFKit.PDFDocument, ctx: Ctx): void {
  const v = verdictOf(ctx);
  const top = doc.y;
  const height = 86;

  doc.roundedRect(PAGE.margin, top, CONTENT_WIDTH, height, 10).fill(v.tint);
  drawVerdictMark(doc, ctx.inspection.inspectionResult, PAGE.margin + 38, top + height / 2, v.color);

  const x = PAGE.margin + 72;
  font(doc, 'semibold', 7.5, v.color).text(v.label, x, top + 17, { characterSpacing: 1.2, lineBreak: false });
  font(doc, 'semibold', 19, COLOR.ink).text(v.title, x, top + 29, { lineBreak: false });
  font(doc, 'regular', 8.5, COLOR.inkMuted).text(v.detail, x, top + 57, {
    width: CONTENT_WIDTH - 72 - 150,
    lineBreak: false,
    ellipsis: true,
  });

  font(doc, 'regular', 6.8, COLOR.inkLight).text('INSPECTED', PAGE.margin, top + 22, {
    width: CONTENT_WIDTH - 20,
    align: 'right',
    characterSpacing: 0.8,
    lineBreak: false,
  });
  font(doc, 'semibold', 9.5, COLOR.ink).text(formatDateTime(ctx.inspection.startedAt), PAGE.margin, top + 34, {
    width: CONTENT_WIDTH - 20,
    align: 'right',
    lineBreak: false,
  });
  const duration = formatDuration(ctx.inspection.durationSeconds);
  if (duration) {
    font(doc, 'regular', 8, COLOR.inkMuted).text(`Took ${duration}`, PAGE.margin, top + 49, {
      width: CONTENT_WIDTH - 20,
      align: 'right',
      lineBreak: false,
    });
  }

  doc.y = top + height + 14;
}

// ── Next steps ─────────────────────────────────────────────────────────────
type Step = { tone: 'bad' | 'warn' | 'muted'; text: string };

function nextSteps(ctx: Ctx): { steps: Step[]; supply: boolean } {
  const steps: Step[] = [];
  let supply = false;
  if (isQuick(ctx)) {
    steps.push(
      ctx.inspection.inspectionResult === 'PASS'
        ? {
            tone: 'warn',
            text: 'Do a full inspection soon: this quick check did not look at the pads, battery or accessories.',
          }
        : {
            tone: 'bad',
            text: 'Do not rely on this AED. Do a full inspection to find the cause — most often the pads or the battery — and contact us for service.',
          },
    );
  }
  const consumables = [
    { itemId: 'pads_expiry' as const, noun: 'the pads', order: 'replacement pads', it: 'they', s: '' },
    { itemId: 'battery_expiry' as const, noun: 'the battery', order: 'a replacement battery', it: 'it', s: 's' },
  ];

  for (const entry of ctx.checklist.filter((c) => c.required)) {
    // A quick check leaves these undone on purpose; its step above says so.
    if (isQuick(ctx) && entry.status === 'pending') continue;
    const consumable = consumables.find((c) => c.itemId === entry.itemId);
    const expiry = consumable ? consumableExpiry(ctx, consumable.itemId) : undefined;

    const when = expiry ? `${expiry.exact ? 'on' : 'in'} ${expiry.label}` : '';
    if (consumable && expiry && expiry.days < 0) {
      steps.push({ tone: 'bad', text: `Replace ${consumable.noun} — ${consumable.it} expired ${when}.` });
      supply = true;
    } else if (entry.status === 'fail') {
      const note = String(entry.notes ?? '').trim().replace(/\.$/, '');
      steps.push({
        tone: 'bad',
        text: `${itemTitle(entry)}${note ? `: ${note}` : ' failed'}. Put it right, then inspect again.`,
      });
    } else if (entry.status === 'error') {
      steps.push({ tone: 'warn', text: `${itemTitle(entry)} couldn't be read from the photo. Check it again.` });
    } else if (entry.status !== 'pass') {
      steps.push({ tone: 'warn', text: `${itemTitle(entry)} wasn't checked. Include it next time.` });
    } else if (consumable && expiry && expiry.days <= REPLACEMENT_WINDOW_DAYS) {
      steps.push({
        tone: 'warn',
        text: `Order ${consumable.order} — ${consumable.it} expire${consumable.s} ${when} (${expiry.describe.toLowerCase()}).`,
      });
      supply = true;
    }
  }

  // An old unit is a replacement conversation, said where the owner reads
  // what to do next.
  const unit = unitAgeOf(ctx);
  if (unit?.band === 'replaceUrgently') {
    steps.push({
      tone: 'bad',
      text: `Replace this AED — made in ${unit.year}, it is past the 10 years an AED usually lasts and may not meet the latest AHA guidelines.`,
    });
    supply = true;
  } else if (unit?.band === 'replace') {
    steps.push({
      tone: 'warn',
      text: `Plan to replace this AED — made in ${unit.year}, about ${unit.age} years old, its warranty has expired under the 5-year replacement policy.`,
    });
    supply = true;
  }

  const next = new Date(ctx.asOf.getTime() + NEXT_CHECK_DAYS * 86_400_000);
  steps.push({ tone: 'muted', text: `Next routine check due by ${formatDay(next)}.` });
  return { steps, supply };
}

function drawNextSteps(doc: PDFKit.PDFDocument, ctx: Ctx): void {
  const { steps, supply } = nextSteps(ctx);
  const pad = 16;
  const textX = PAGE.margin + pad + 13;
  const textWidth = CONTENT_WIDTH - pad * 2 - 13;
  const gap = 6;

  font(doc, 'regular', 9, COLOR.ink);
  const heights = steps.map((s) => doc.heightOfString(s.text, { width: textWidth, lineGap: 1.5 }));
  const supplyText = `aedsmartx by Think Health supplies new AEDs, and replacement pads, batteries and accessories for the ${ctx.model} — aedsmartx.com`;
  font(doc, 'regular', 7.8, COLOR.inkMuted);
  const supplyHeight = supply ? doc.heightOfString(supplyText, { width: textWidth + 13, lineGap: 1 }) + 10 : 0;
  const height = pad + 16 + heights.reduce((a, b) => a + b, 0) + gap * (steps.length - 1) + supplyHeight + pad - 2;

  ensureSpace(doc, height + 12);
  const top = doc.y;
  doc.roundedRect(PAGE.margin, top, CONTENT_WIDTH, height, 10).lineWidth(0.8).strokeColor(COLOR.line).stroke();

  font(doc, 'semibold', 7.5, COLOR.primary).text('NEXT STEPS', PAGE.margin + pad, top + pad, {
    characterSpacing: 1.1,
    lineBreak: false,
  });

  let y = top + pad + 16;
  steps.forEach((step, i) => {
    const dot = step.tone === 'bad' ? COLOR.bad : step.tone === 'warn' ? COLOR.warn : COLOR.inkLight;
    doc.circle(PAGE.margin + pad + 3, y + 5.2, 2.6).fill(dot);
    font(doc, step.tone === 'muted' ? 'regular' : 'medium', 9, step.tone === 'muted' ? COLOR.inkMuted : COLOR.ink).text(
      step.text,
      textX,
      y,
      { width: textWidth, lineGap: 1.5 },
    );
    y += heights[i] + gap;
  });

  if (supply) {
    y += 4;
    doc
      .moveTo(PAGE.margin + pad, y - 5)
      .lineTo(RIGHT_EDGE - pad, y - 5)
      .lineWidth(0.5)
      .strokeColor(COLOR.lineSoft)
      .stroke();
    font(doc, 'regular', 7.8, COLOR.inkMuted).text(supplyText, PAGE.margin + pad, y + 2, {
      width: textWidth + 13,
      lineGap: 1,
    });
  }

  doc.y = top + height + 20;
}

// ── Detail grids ───────────────────────────────────────────────────────────
type Detail = { label: string; value: string; mono?: boolean; sub?: { text: string; color: string } };

function drawDetailGrid(doc: PDFKit.PDFDocument, details: Detail[]): void {
  const gutter = 20;
  const colWidth = (CONTENT_WIDTH - gutter) / 2;

  for (let i = 0; i < details.length; i += 2) {
    const row = details.slice(i, i + 2);
    const rowHeight = row.some((d) => d.sub) ? 44 : 34;
    ensureSpace(doc, rowHeight);
    const top = doc.y;

    row.forEach((d, c) => {
      const x = PAGE.margin + c * (colWidth + gutter);
      font(doc, 'regular', 6.8, COLOR.inkLight).text(d.label.toUpperCase(), x, top, {
        width: colWidth,
        characterSpacing: 0.7,
        lineBreak: false,
      });
      font(doc, d.mono ? 'mono' : 'semibold', d.mono ? 9.8 : 10.2, COLOR.ink).text(d.value, x, top + 11, {
        width: colWidth,
        ellipsis: true,
        lineBreak: false,
      });
      if (d.sub) {
        font(doc, 'medium', 8, d.sub.color).text(d.sub.text, x, top + 25, { width: colWidth, lineBreak: false });
      }
    });

    const bottom = top + rowHeight;
    if (i + 2 < details.length) {
      doc
        .moveTo(PAGE.margin, bottom - 8)
        .lineTo(RIGHT_EDGE, bottom - 8)
        .lineWidth(0.5)
        .strokeColor(COLOR.lineSoft)
        .stroke();
    }
    doc.y = bottom;
  }

  doc.y += 16;
}

/** A Powerheart battery prints no expiry; the date shown is worked out from
 *  when it was made or installed, so it is a replace-by date. */
function batteryDateReckoned(ctx: Ctx): boolean {
  const entry = ctx.checklist.find((c) => c.itemId === 'battery_expiry');
  const overrides = (entry?.aiData as { meta?: { overrides?: unknown } } | undefined)?.meta?.overrides;
  return Array.isArray(overrides) && overrides.some((o) => String(o).startsWith('battery_dated_from_'));
}

/** How old the unit is, from its serial label (utils/device-age). */
function unitAgeOf(ctx: Ctx) {
  const entry = ctx.checklist.find((c) => c.itemId === 'serial_number' && c.status === 'pass');
  const ai = (entry?.aiData ?? {}) as Record<string, unknown>;
  return entry ? deviceAge(ctx.inspection.aedModel, ai.serial_number ?? ctx.inspection.serialNumber, ai.manufacture_date) : null;
}

const AGE_COLOR = { current: COLOR.ok, checkInvoice: COLOR.warn, replace: '#c2410c', replaceUrgently: COLOR.bad };

function unitAgeLine(ctx: Ctx): { text: string; color: string } | undefined {
  const a = unitAgeOf(ctx);
  if (!a) return undefined;
  const text = {
    current: `Made in ${a.year} · under warranty`,
    checkInvoice: `Made in ${a.year} · warranty may still be valid: check the invoice`,
    replace: `Made in ${a.year} · about ${a.age} years old · replacement recommended`,
    replaceUrgently: `Made in ${a.year} · over 10 years old · replacement strongly recommended`,
  }[a.band];
  return { text, color: AGE_COLOR[a.band] };
}

function deviceDetails(ctx: Ctx): Detail[] {
  const i = ctx.inspection;
  const pads = consumableExpiry(ctx, 'pads_expiry');
  const battery = consumableExpiry(ctx, 'battery_expiry');
  const status = typeof i.statusIndicator === 'string' ? STATUS_WORD[i.statusIndicator.toLowerCase()] : undefined;
  const lot = [i.batteryLot, i.batterySerialNumber].filter(Boolean).join(' / ');

  const details: Detail[] = [
    { label: 'AED model', value: ctx.model },
    {
      label: 'Serial number',
      value: i.serialNumber ?? 'Not read',
      mono: Boolean(i.serialNumber),
      sub: unitAgeLine(ctx),
    },
    {
      label: 'Pads expiry',
      value: pads?.label ?? (isQuick(ctx) ? 'Not checked' : 'Not read'),
      sub: pads?.describe ? { text: pads.describe, color: pads.color } : undefined,
    },
    {
      label: batteryDateReckoned(ctx) ? 'Battery replace by' : 'Battery expiry',
      value: battery?.label ?? (isQuick(ctx) ? 'Not checked' : 'Not read'),
      sub: battery?.describe ? { text: battery.describe, color: battery.color } : undefined,
    },
    { label: 'Readiness indicator', value: status?.text ?? i.statusIndicator ?? 'Not checked' },
  ];
  if (lot) details.push({ label: 'Battery lot / serial', value: lot });
  return details;
}

function inspectionDetails(ctx: Ctx): Detail[] {
  const i = ctx.inspection;
  const details: Detail[] = [
    { label: 'Inspected by', value: i.guestName ?? i.inspector?.name ?? 'Not recorded' },
    { label: 'Email', value: i.guestEmail ?? i.inspector?.email ?? 'Not provided' },
  ];
  if (i.guestPhone) details.push({ label: 'Phone', value: formatPhone(String(i.guestPhone)) });
  if (i.locationId) details.push({ label: 'Location', value: String(i.locationId) });
  details.push({ label: 'Report', value: ctx.shortId, mono: true });
  return details;
}

// ── Checks, each with its evidence ─────────────────────────────────────────
const THUMB_W = 80;
const THUMB_H = 60;
const STATUS_COL = 86;

function mediaUrlToDiskPath(mediaUrl: string): string {
  return path.join(config.UPLOAD_DIR, mediaUrl.replace(/^\/uploads\//, ''));
}

function drawThumbnail(doc: PDFKit.PDFDocument, entry: Entry, x: number, y: number): void {
  const mediaType = entry.mediaType ?? itemMeta(entry)?.mediaType;
  const radius = 6;

  if (entry.mediaUrl && mediaType === 'image') {
    const diskPath = mediaUrlToDiskPath(entry.mediaUrl);
    if (fs.existsSync(diskPath)) {
      doc.save();
      let drawn = false;
      try {
        doc.roundedRect(x, y, THUMB_W, THUMB_H, radius).clip();
        doc.image(diskPath, x, y, { cover: [THUMB_W, THUMB_H], align: 'center', valign: 'center' });
        drawn = true;
      } catch {
        // Corrupt or unsupported image — a placeholder is drawn below.
      }
      doc.restore();
      if (drawn) {
        doc.roundedRect(x, y, THUMB_W, THUMB_H, radius).lineWidth(0.6).strokeColor(COLOR.line).stroke();
        return;
      }
    }
  }

  if (entry.mediaUrl && mediaType === 'video') {
    // A video can't be printed; the tile says one was taken and read.
    doc.roundedRect(x, y, THUMB_W, THUMB_H, radius).fill(COLOR.primaryTint);
    const cx = x + THUMB_W / 2;
    const cy = y + THUMB_H / 2 - 6;
    doc.circle(cx, cy, 11).fill(COLOR.white);
    doc
      .moveTo(cx - 3.2, cy - 5.5)
      .lineTo(cx + 5.8, cy)
      .lineTo(cx - 3.2, cy + 5.5)
      .closePath()
      .fill(COLOR.primary);
    font(doc, 'medium', 7, COLOR.primary).text('Video', x, y + THUMB_H - 15, {
      width: THUMB_W,
      align: 'center',
      lineBreak: false,
    });
    return;
  }

  doc.roundedRect(x, y, THUMB_W, THUMB_H, radius).fill(COLOR.neutralTint);
  font(doc, 'regular', 7, COLOR.inkLight).text(entry.mediaUrl ? 'Photo unavailable' : 'No photo', x, y + THUMB_H / 2 - 4, {
    width: THUMB_W,
    align: 'center',
    lineBreak: false,
  });
}

function drawCheckRow(doc: PDFKit.PDFDocument, ctx: Ctx, entry: Entry, first: boolean): void {
  const swatch = itemSwatch(entry.status);
  const title = itemTitle(entry);
  const required = itemMeta(entry)?.required ?? entry.required;
  const reading = entry.status === 'pass' || entry.status === 'fail' ? readingOf(entry, ctx.asOf) : undefined;
  // A capture the AI never read carries the upload error, which is for the
  // inspector at the time, not for the record.
  const notes =
    entry.status === 'error'
      ? 'The AI couldn’t analyse this capture, so this check has no result.'
      : String(entry.notes ?? '').trim();

  const textX = PAGE.margin + THUMB_W + 16;
  const textWidth = CONTENT_WIDTH - THUMB_W - 16 - STATUS_COL;

  font(doc, 'regular', 8, COLOR.inkMuted);
  const notesHeight = notes ? Math.min(doc.heightOfString(notes, { width: textWidth, lineGap: 1.2 }), 32) : 0;
  const contentHeight = 14 + (reading ? 15 : 0) + (notes ? notesHeight + 2 : 0);
  const rowHeight = Math.max(THUMB_H, contentHeight) + 20;

  ensureSpace(doc, rowHeight);
  const top = doc.y;
  if (!first && top > CONTINUATION_TOP + 1) {
    doc.moveTo(PAGE.margin, top).lineTo(RIGHT_EDGE, top).lineWidth(0.6).strokeColor(COLOR.lineSoft).stroke();
  }

  const y = top + 10;
  drawThumbnail(doc, entry, PAGE.margin, y);

  font(doc, 'semibold', 10, COLOR.ink).text(title, textX, y + 1, { width: textWidth, lineBreak: false, ellipsis: true });
  if (!required) {
    const w = doc.widthOfString(title);
    font(doc, 'medium', 6.3, COLOR.inkLight).text('OPTIONAL', textX + Math.min(w, textWidth - 40) + 6, y + 3.6, {
      characterSpacing: 0.6,
      lineBreak: false,
    });
  }

  let lineY = y + 16;
  if (reading) {
    font(doc, reading.mono ? 'mono' : 'semibold', reading.mono ? 9 : 9.2, COLOR.ink).text(reading.text, textX, lineY, {
      lineBreak: false,
      continued: Boolean(reading.sub),
    });
    if (reading.sub) {
      font(doc, 'medium', 8.2, reading.sub.color).text(`  ·  ${reading.sub.describe}`, { lineBreak: false });
    }
    lineY += 15;
  }
  if (notes) {
    font(doc, 'regular', 8, COLOR.inkMuted).text(notes, textX, lineY, {
      width: textWidth,
      height: notesHeight,
      lineGap: 1.2,
      ellipsis: true,
    });
  }

  const statusWidth = pillWidth(doc, swatch.label, 7);
  pill(doc, swatch.label, RIGHT_EDGE - statusWidth, y, swatch);
  if (typeof entry.confidence === 'number' && (entry.status === 'pass' || entry.status === 'fail')) {
    font(doc, 'regular', 7, COLOR.inkLight).text(`Confidence ${Math.round(entry.confidence * 100)}%`, RIGHT_EDGE - STATUS_COL, y + 20, {
      width: STATUS_COL,
      align: 'right',
      lineBreak: false,
    });
  }

  doc.y = top + rowHeight;
}

function drawChecks(doc: PDFKit.PDFDocument, ctx: Ctx): void {
  const entries = reportedEntries(ctx);
  // Never strand the heading at the foot of a page: it goes over with at
  // least its first row.
  ensureSpace(doc, 40 + 26 + THUMB_H + 20);
  drawSectionLabel(doc, 'Checks');

  const sectionOf = (c: Entry) => itemMeta(c)?.section ?? c.section;
  const orderOf = (c: Entry) => itemMeta(c)?.order ?? 99;
  for (const section of [1, 2, 3]) {
    const rows = entries.filter((c) => sectionOf(c) === section).sort((a, b) => orderOf(a) - orderOf(b));
    if (!rows.length) continue;

    ensureSpace(doc, 26 + THUMB_H + 20);
    font(doc, 'semibold', 8.5, COLOR.inkMuted).text(SECTION_TITLES[section], PAGE.margin, doc.y, { lineBreak: false });
    doc.y += 12;
    rows.forEach((entry, i) => drawCheckRow(doc, ctx, entry, i === 0));
    doc.y += 12;
  }

  const disclaimer =
    'An AI-assisted visual inspection, made from photos and video taken on site. It supports the manufacturer’s maintenance schedule and does not replace it.';
  font(doc, 'regular', 7.2, COLOR.inkLight);
  const h = doc.heightOfString(disclaimer, { width: CONTENT_WIDTH, lineGap: 1 });
  ensureSpace(doc, h + 4);
  doc.text(disclaimer, PAGE.margin, doc.y, { width: CONTENT_WIDTH, lineGap: 1 });
}

// ── Footer + running header, drawn across all pages at the end ─────────────
function drawPageFurniture(doc: PDFKit.PDFDocument, ctx: Ctx): void {
  const range = doc.bufferedPageRange();
  const serial = ctx.inspection.serialNumber;

  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);

    // The footer deliberately sits below the text-body bottom margin. Without
    // this, PDFKit treats drawing there as an overflow and helpfully appends a
    // blank page — once per page, each carrying an orphaned page number.
    doc.page.margins.bottom = 0;

    if (i > 0) {
      drawLockup(doc, PAGE.margin, PAGE.margin - 13, 10, 8.5);
      font(doc, 'regular', 7.5, COLOR.inkLight).text(
        [ctx.model, serial ? `SN ${serial}` : undefined, ctx.sample ? 'Sample' : `Report ${ctx.shortId}`]
          .filter(Boolean)
          .join('  ·  '),
        PAGE.margin,
        PAGE.margin - 10,
        { width: CONTENT_WIDTH, align: 'right', lineBreak: false },
      );
      doc
        .moveTo(PAGE.margin, PAGE.margin + 5)
        .lineTo(RIGHT_EDGE, PAGE.margin + 5)
        .lineWidth(0.6)
        .strokeColor(COLOR.line)
        .stroke();
    }

    const footerY = PAGE.height - 40;
    doc.moveTo(PAGE.margin, footerY).lineTo(RIGHT_EDGE, footerY).lineWidth(0.6).strokeColor(COLOR.line).stroke();

    font(doc, 'regular', 7, COLOR.inkLight).text(
      'aedsmartx Inspector  ·  A Think Health™ product  ·  aedsmartx.com  ·  thinkhealth.in',
      PAGE.margin,
      footerY + 9,
      { lineBreak: false },
    );
    font(doc, 'regular', 6.5, COLOR.inkLight).text(
      ctx.sample
        ? `Sample report: a fictional inspection, for illustration only  ·  Generated ${formatDateTime(ctx.generatedAt)}`
        : `Inspection ID ${ctx.inspection.inspectionId}  ·  Generated ${formatDateTime(ctx.generatedAt)}`,
      PAGE.margin,
      footerY + 19,
      { lineBreak: false },
    );
    font(doc, 'semibold', 7.5, COLOR.inkMuted).text(`Page ${i + 1} of ${range.count}`, RIGHT_EDGE - 80, footerY + 13, {
      width: 80,
      align: 'right',
      lineBreak: false,
    });
  }
}

/** A PDFDocument configured for this report — buffered so footers can be
 *  stamped across every page once the total page count is known. */
export function createReportDoc(): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    margin: PAGE.margin,
    bufferPages: true,
    info: { Title: 'AED inspection report', Author: 'Think Health', Creator: 'AED SmartX Inspector' },
  });
  registerFonts(doc);
  return doc;
}

export interface RenderOptions {
  /** Marks the report as a sample (the landing page's example). */
  sample?: boolean;
  /** Fixes the "generated" stamp — for the sample, so re-rendering it
   *  doesn't change the file. */
  generatedAt?: Date;
}

/** Writes the full report into a document from createReportDoc(). The caller
 *  owns piping and calling .end(). */
export function renderInspectionPdf(
  doc: PDFKit.PDFDocument,
  inspection: Record<string, any>,
  options: RenderOptions = {},
): void {
  registerFonts(doc);
  const asOfRaw = inspection.completedAt ?? inspection.startedAt;
  const asOf = asOfRaw && !Number.isNaN(new Date(asOfRaw).getTime()) ? new Date(asOfRaw) : new Date();
  const ctx: Ctx = {
    inspection,
    checklist: inspection.checklist ?? [],
    asOf,
    model: MODEL_NAMES[inspection.aedModel] ?? inspection.aedModel ?? 'AED',
    shortId: String(inspection.inspectionId ?? '').slice(0, 8).toUpperCase(),
    sample: Boolean(options.sample),
    generatedAt: options.generatedAt ?? new Date(),
  };

  drawHeaderBand(doc, ctx);
  drawVerdict(doc, ctx);
  drawNextSteps(doc, ctx);

  drawSectionLabel(doc, 'Device');
  drawDetailGrid(doc, deviceDetails(ctx));

  drawSectionLabel(doc, 'Inspection');
  drawDetailGrid(doc, inspectionDetails(ctx));

  drawChecks(doc, ctx);
  drawPageFurniture(doc, ctx);
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
