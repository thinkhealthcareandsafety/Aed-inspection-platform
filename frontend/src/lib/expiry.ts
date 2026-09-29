import type { ExpiryUrgency } from '@/types/insights';

/**
 * Expiry dates the way the person holding the AED should read them.
 *
 * Mirrors backend/src/utils/expiry.ts: a label printed 'YYYY-MM' is good
 * through the last day of that month (the convention on medical
 * consumables), so "Mar 2027" doesn't read as lapsed on the 2nd of March.
 * The server's clock still decides pass or fail; this only phrases it.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseExpiry(raw?: string | null): Date | undefined {
  if (!raw) return undefined;
  const value = raw.trim();

  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (full) {
    const date = new Date(Date.UTC(Number(full[1]), Number(full[2]) - 1, Number(full[3]), 23, 59, 59));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  const month = /^(\d{4})-(\d{2})$/.exec(value);
  if (month) {
    // Day 0 of the next month is the last day of this one.
    const date = new Date(Date.UTC(Number(month[1]), Number(month[2]), 0, 23, 59, 59));
    return Number.isNaN(date.getTime()) ? undefined : date;
  }

  return undefined;
}

/** The AI normalises expiries to 'YYYY-MM'. That's the right shape to store
 *  and the wrong one to show a human, so it reads as 'Mar 2027' on screen. */
export function formatExpiry(raw: string): string {
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (full) return `${Number(full[3])} ${MONTHS[Number(full[2]) - 1]} ${full[1]}`;
  const month = /^(\d{4})-(\d{2})$/.exec(raw);
  if (month) return `${MONTHS[Number(month[2]) - 1]} ${month[1]}`;
  return raw;
}

/** Whole days from now until `date` — negative once it has lapsed. */
export function daysUntil(date: Date, from: Date = new Date()): number {
  return Math.ceil((date.getTime() - from.getTime()) / 86_400_000);
}

/** Same buckets as the sales pipeline, so what the customer is told and what
 *  the sales team sees can never disagree. */
export function urgencyOf(days: number): ExpiryUrgency {
  if (days < 0) return 'expired';
  if (days <= 30) return 'critical';
  if (days <= 90) return 'soon';
  return 'ok';
}

/** "Expired 3 months ago", "42 days left", "2+ years left". Written for the
 *  customer: the dashboard's "18 days overdue" is phrased for the sales desk. */
export function describeExpiry(days: number): string {
  if (days < 0) {
    const ago = -days;
    if (ago < 45) return ago === 1 ? 'Expired yesterday' : `Expired ${ago} days ago`;
    const months = Math.round(ago / 30.44);
    return months < 24 ? `Expired ${months} months ago` : `Expired ${Math.floor(months / 12)}+ years ago`;
  }
  if (days === 0) return 'Expires today';
  if (days < 45) return days === 1 ? '1 day left' : `${days} days left`;
  const months = Math.round(days / 30.44);
  return months < 24 ? `${months} months left` : `${Math.floor(months / 12)}+ years left`;
}
