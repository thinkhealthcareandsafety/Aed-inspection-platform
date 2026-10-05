import type { ChecklistItemId, ChecklistItemResult } from '@/types';

/**
 * The readiness score: marks out of 100, Think Health's marking scheme
 * (October 2026). A check earns its marks when it passes. Keep in sync with
 * backend/src/config/scoring.ts, which decides the report's verdict.
 */
export const CHECK_POINTS: Record<ChecklistItemId, number> = {
  pads_expiry: 20,
  battery_expiry: 20,
  // On the two Philips units this becomes 20 for the ready light and 10 for
  // the i-button once the check reads the i-button; every other model has
  // no i-button, and its indicator is worth all 30.
  readiness_indicator: 30,
  pads_connected: 5,
  battery_attached: 5,
  serial_number: 10,
  child_key_pad: 2,
  emergency_contacts: 2,
  aed_cabinet: 3,
  first_response_kit: 3,
};

export const MAX_SCORE = 100;

/** Below this, the AED fails readiness. */
export const READY_THRESHOLD = 80;

export function scoreOf(checklist: Pick<ChecklistItemResult, 'itemId' | 'status'>[]): number {
  return checklist.reduce((sum, c) => sum + (c.status === 'pass' ? (CHECK_POINTS[c.itemId] ?? 0) : 0), 0);
}
