import type { ChecklistItemId } from '@/types';

export interface ReferenceExample {
  src: string;
  caption: string;
  kind: 'good' | 'bad' | 'neutral';
  /**
   * Which AED models this photo actually depicts. Omit only when the photo is
   * genuinely brand-agnostic (a wall cabinet, a rescue kit). Never tag a photo
   * with a model it doesn't show — an inspector holding a blue Philips and
   * shown a green Zoll learns the wrong thing, which is worse than showing
   * them no example at all.
   */
  models?: string[];
}

const PHILIPS = ['Philips FRx', 'Philips HS1'];

/**
 * Real reference photos showing inspectors exactly what to capture for a
 * given checklist item. Not every item has one for every model — that's fine
 * and deliberate; the affordance simply doesn't appear where no genuine,
 * accurate photo exists.
 */
export const REFERENCE_EXAMPLES: Partial<Record<ChecklistItemId, ReferenceExample[]>> = {
  serial_number: [
    { src: '/reference/serial-philips-frx.jpg', caption: 'Philips FRx — serial number on the rear label', kind: 'neutral', models: ['Philips FRx'] },
    { src: '/reference/serial-philips-hs1.jpg', caption: 'Philips HS1 — serial number on the rear label', kind: 'neutral', models: ['Philips HS1'] },
    { src: '/reference/serial-zoll-aed-plus.jpg', caption: 'Zoll AED Plus — serial number on the rear label', kind: 'neutral', models: ['Zoll AED Plus'] },
  ],

  // Philips ships two different pads cartridges. Rather than assert which
  // model takes which (and risk being wrong), both are shown to Philips
  // inspectors and captioned by what the cartridge physically looks like —
  // the inspector matches the one in their hand.
  pads_expiry: [
    { src: '/reference/pads-philips-frx.jpg', caption: 'Clear pull-tab cartridge — date is printed below the torso diagram', kind: 'neutral', models: PHILIPS },
    { src: '/reference/pads-philips-hs1.jpg', caption: 'Grey "Smart Pads II" cartridge — date is on the front label', kind: 'neutral', models: PHILIPS },
    { src: '/reference/pads-zoll-aed-plus.jpg', caption: 'Zoll AED Plus — expiry date on the CPR-D-padz box', kind: 'neutral', models: ['Zoll AED Plus'] },
  ],

  battery_expiry: [
    { src: '/reference/battery-philips.jpg', caption: 'Philips FRx — expiry date is printed on the battery label', kind: 'neutral', models: ['Philips FRx'] },
  ],

  battery_attached: [
    { src: '/reference/battery-rear.jpg', caption: 'Zoll AED Plus — sealed battery pack properly installed', kind: 'good', models: ['Zoll AED Plus'] },
    { src: '/reference/battery-compartment.jpg', caption: 'Zoll AED Plus — battery pack missing, exposed cells', kind: 'bad', models: ['Zoll AED Plus'] },
  ],

  pads_connected: [
    { src: '/reference/pads-connected.jpg', caption: 'Zoll AED Plus — connected, pads cable plugged into the unit', kind: 'good', models: ['Zoll AED Plus'] },
    { src: '/reference/pads-disconnected.jpg', caption: 'Zoll AED Plus — not connected, this needs fixing', kind: 'bad', models: ['Zoll AED Plus'] },
  ],

  // True of either Philips HeartStart: the small status light sits beside the
  // power button, whichever pads cartridge the unit carries.
  readiness_indicator: [
    { src: '/reference/readiness-indicator.jpg', caption: 'Philips HeartStart — status light sits beside the power button', kind: 'neutral', models: PHILIPS },
  ],

  child_key_pad: [
    { src: '/reference/child-key.jpg', caption: 'Philips FRx — infant/child key', kind: 'neutral', models: ['Philips FRx'] },
  ],

  aed_cabinet: [
    { src: '/reference/aed-cabinet.jpg', caption: 'Wall cabinet, door closed, clearly signed', kind: 'good' },
  ],

  first_response_kit: [
    { src: '/reference/first-response-kit.jpg', caption: 'Rescue kit pouch — gloves, razor, scissors, mask', kind: 'good' },
  ],
};

/**
 * Returns the reference photos for a checklist item, narrowed to the AED
 * model actually being inspected.
 *
 * An untagged photo is brand-agnostic and shows for everyone. A tagged photo
 * shows only for the models it actually depicts: if this item has photos but
 * none for the model in hand, the caller gets nothing and hides the
 * affordance entirely.
 */
export function getReferenceExamples(itemId: ChecklistItemId, aedModel?: string): ReferenceExample[] | undefined {
  const all = REFERENCE_EXAMPLES[itemId];
  if (!all) return undefined;
  if (!aedModel) return all;
  const matched = all.filter((ex) => !ex.models || ex.models.includes(aedModel));
  return matched.length ? matched : undefined;
}
