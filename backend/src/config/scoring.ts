/**
 * The readiness score: marks out of 100, Think Health's marking scheme
 * (October 2026). A check scores its marks when it passes, nothing
 * otherwise. Keep in sync with frontend/src/lib/score.ts.
 */
export const CHECK_POINTS: Record<string, number> = {
  // Required — 90
  pads_expiry: 20,
  battery_expiry: 20,
  // 30 for the readiness indicator on every model. On the two Philips units
  // (FRx, HS1) it will be split — 20 for the ready light, 10 for the
  // i-button — once the check reads the i-button; until then a ready verdict
  // earns all 30. No other model has an i-button.
  readiness_indicator: 30,
  pads_connected: 5,
  battery_attached: 5,
  serial_number: 10,
  // Optional extras — 10
  child_key_pad: 2,
  emergency_contacts: 2,
  aed_cabinet: 3,
  first_response_kit: 3,
};

export const MAX_SCORE = 100;

/** Below this, the AED fails readiness. */
export const READY_THRESHOLD = 80;

/**
 * Checks that, failed, mean the AED can't be relied on whatever it scores.
 * Unplugged pads cost only 5 marks — the unit would score 85 — but an AED
 * whose pads aren't connected cannot deliver a shock. Together these are
 * worth exactly 80, so an AED that passes every one of them always reaches
 * the threshold: the two rules never disagree on a unit that passes.
 */
export const SAFETY_CRITICAL = ['pads_expiry', 'battery_expiry', 'readiness_indicator', 'pads_connected', 'battery_attached'];

export function readinessScore(checklist: ReadonlyArray<{ itemId?: unknown; status?: unknown }>): number {
  return checklist.reduce((sum, c) => sum + (c.status === 'pass' ? (CHECK_POINTS[String(c.itemId)] ?? 0) : 0), 0);
}
