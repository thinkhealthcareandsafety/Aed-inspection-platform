import { daysUntil, formatExpiry, parseExpiry } from './expiry';
import type { ChecklistItemResult } from '@/types';
import { en, type Messages } from '@/i18n/en';

export interface Reading {
  /** What was read — "Serial number", "Expiry date", "Status light". */
  label: string;
  /** What the AI read off the capture, ready to display. */
  value: string;
  /** Codes read character by character (serials) set in mono. */
  mono: boolean;
  /** Present when the reading is a date something dies on. */
  expiry?: { at: Date; days: number };
}

/**
 * What the AI read off a capture, if it read anything worth showing back.
 * Seeing "B17C-00514" appear from a photo is the moment the product becomes
 * believable, so it gets stated rather than buried in a confidence score.
 */
export function readingOf(result: ChecklistItemResult, m: Messages = en): Reading | null {
  const data = result.aiData as Record<string, unknown> | undefined;
  if (!data) return null;

  const serial = typeof data.serial_number === 'string' ? data.serial_number.trim() : '';
  if (serial) return { label: m.reading.serial, value: serial, mono: true };

  const expiry = typeof data.expiry_date === 'string' ? data.expiry_date.trim() : '';
  if (expiry) {
    const at = parseExpiry(expiry);
    return {
      label: m.reading.expiry,
      value: formatExpiry(expiry, m.expiry),
      mono: false,
      expiry: at ? { at, days: daysUntil(at) } : undefined,
    };
  }

  const status = typeof data.status === 'string' ? m.reading.status[data.status.toLowerCase()] : undefined;
  if (result.itemId === 'readiness_indicator' && status) {
    return { label: m.reading.statusLight, value: status, mono: false };
  }

  return null;
}
