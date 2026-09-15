import type { ChecklistItemId } from '@/types';

export interface ReferenceExample {
  src: string;
  caption: string;
  kind: 'good' | 'bad' | 'neutral';
}

/**
 * Real reference photos showing inspectors exactly what to capture for a
 * given checklist item — not every item has one yet (only add an entry once
 * a genuine, accurate photo exists; never a stand-in that might mislead an
 * inspector about what a pass/fail actually looks like).
 */
export const REFERENCE_EXAMPLES: Partial<Record<ChecklistItemId, ReferenceExample[]>> = {
  battery_expiry: [
    { src: '/reference/battery-philips.jpg', caption: 'Expiry date is printed on the battery label', kind: 'neutral' },
  ],
  battery_attached: [
    { src: '/reference/battery-compartment.jpg', caption: 'Battery cells correctly seated in the compartment', kind: 'good' },
    { src: '/reference/battery-rear.jpg', caption: 'Battery pack fully fitted to the rear panel', kind: 'good' },
  ],
  pads_connected: [
    { src: '/reference/pads-connected.jpg', caption: 'Connected — pads cable plugged into the unit', kind: 'good' },
    { src: '/reference/pads-disconnected.jpg', caption: 'Not connected — this needs fixing', kind: 'bad' },
  ],
  readiness_indicator: [
    { src: '/reference/readiness-indicator.jpg', caption: 'Status light sits next to the power button', kind: 'neutral' },
  ],
  aed_cabinet: [
    { src: '/reference/aed-cabinet.jpg', caption: 'Wall cabinet, door closed, clearly signed', kind: 'good' },
  ],
  first_response_kit: [
    { src: '/reference/first-response-kit.jpg', caption: 'Rescue kit pouch — gloves, razor, scissors, mask', kind: 'good' },
  ],
};

export function getReferenceExamples(itemId: ChecklistItemId): ReferenceExample[] | undefined {
  return REFERENCE_EXAMPLES[itemId];
}
