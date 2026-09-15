import type { ChecklistItemId } from '@/types';

export interface ReferenceExample {
  src: string;
  caption: string;
  kind: 'good' | 'bad' | 'neutral';
  /** Set only when separate photos exist per AED model for this item —
   *  getReferenceExamples() uses it to show just the one matching model. */
  model?: string;
}

/**
 * Real reference photos showing inspectors exactly what to capture for a
 * given checklist item — not every item has one yet (only add an entry once
 * a genuine, accurate photo exists; never a stand-in that might mislead an
 * inspector about what a pass/fail actually looks like).
 */
export const REFERENCE_EXAMPLES: Partial<Record<ChecklistItemId, ReferenceExample[]>> = {
  serial_number: [
    { src: '/reference/serial-philips-frx.jpg', caption: 'Philips FRx — serial number on the rear label', kind: 'neutral', model: 'Philips FRx' },
    { src: '/reference/serial-philips-hs1.jpg', caption: 'Philips HS1 — serial number on the rear label', kind: 'neutral', model: 'Philips HS1' },
    { src: '/reference/serial-zoll-aed-plus.jpg', caption: 'Zoll AED Plus — serial number on the rear label', kind: 'neutral', model: 'Zoll AED Plus' },
  ],
  battery_expiry: [
    { src: '/reference/battery-philips.jpg', caption: 'Expiry date is printed on the battery label', kind: 'neutral' },
  ],
  child_key_pad: [
    { src: '/reference/child-key.jpg', caption: 'Infant/child key — paediatric dose attenuator', kind: 'neutral' },
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

/**
 * Returns the reference photos for a checklist item. When several photos
 * exist for that item (one per AED model, e.g. serial_number) and the
 * inspection's model is known, narrows to just the matching one so the
 * inspector only ever sees their actual unit — falls back to showing all of
 * them if the model is unknown or none match.
 */
export function getReferenceExamples(itemId: ChecklistItemId, aedModel?: string): ReferenceExample[] | undefined {
  const all = REFERENCE_EXAMPLES[itemId];
  if (!all) return undefined;
  if (!aedModel) return all;
  const matched = all.filter((ex) => !ex.model || ex.model === aedModel);
  return matched.length ? matched : all;
}
