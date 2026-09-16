/**
 * Expiry dates are the commercially load-bearing field in an inspection: a
 * dated, model-specific replacement need for a consumable that is illegal to
 * let lapse. The CV service hands us a normalised string ('YYYY-MM' or
 * 'YYYY-MM-DD'); this turns it into a real Date so it can be indexed, sorted
 * and queried ("everything expiring in the next 90 days") rather than only
 * printed on a report.
 */

/**
 * A label printed 'YYYY-MM' means "usable through the end of that month" —
 * the convention on medical consumables — so a month-only expiry resolves to
 * the last instant of that month rather than its first day. Getting this
 * backwards would tell a customer their pads died four weeks early.
 */
export function toExpiryDate(raw?: string | null): Date | undefined {
  if (!raw) return undefined;
  const value = raw.trim();

  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (full) {
    const [, y, m, d] = full;
    const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d), 23, 59, 59));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) {
    const [, y, m] = month;
    // Day 0 of the *next* month is the last day of this one.
    const date = new Date(Date.UTC(Number(y), Number(m), 0, 23, 59, 59));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

/** Whole days from now until `date` — negative once it has lapsed. */
export function daysUntil(date: Date, from: Date = new Date()): number {
  return Math.ceil((date.getTime() - from.getTime()) / 86_400_000);
}

export type ExpiryUrgency = 'expired' | 'critical' | 'soon' | 'ok';

/**
 * Buckets chosen around how the sale actually runs: past due is a compliance
 * problem to fix today, 30 days is inside a purchase-order cycle, 90 days is
 * far enough out to be a planned quote rather than a scramble.
 */
export function urgencyOf(days: number): ExpiryUrgency {
  if (days < 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'soon';
  return 'ok';
}
