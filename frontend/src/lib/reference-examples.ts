import type { ChecklistItemId } from '@/types';

/** A region of a reference photo, as fractions (0-1) of its width and height. */
export interface Focus {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
  /**
   * The exact part to look at. Drawn by the app as a spotlight, with a
   * magnified inset when the part is small — never burned into the photo,
   * so every example is marked the same way, in both themes.
   */
  focus?: Focus;
}

/*
 * Every photo in /public/reference is a 4:3 frame (1200 x 900) with the
 * subject centred on a plain backdrop, and carries no annotation of its own.
 * To add one: shoot the part on a plain surface, crop to 4:3, drop the file
 * in, and give it a `focus` below.
 *
 * One view of a device serves several checks — the back of a Philips unit
 * shows the serial label, the battery and the battery's date — so the same
 * file appears more than once with a different focus, and is downloaded once.
 */

const PHILIPS = ['Philips FRx', 'Philips HS1'];

const FRX_BACK = '/reference/philips-frx-back.jpg';
const HS1_BACK = '/reference/philips-hs1-back.jpg';
const HS1_FRONT = '/reference/philips-hs1-front.jpg';
const FRX_PADS = '/reference/philips-frx-pads.jpg';
const ZOLL_FRONT = '/reference/zoll-aed-plus-pads-connected.jpg';

export const REFERENCE_EXAMPLES: Partial<Record<ChecklistItemId, ReferenceExample[]>> = {
  serial_number: [
    {
      src: FRX_BACK,
      focus: { x: 0.3898, y: 0.7757, w: 0.1405, h: 0.1195 },
      caption: 'The “SN” label at the bottom of the back panel.',
      kind: 'neutral',
      models: ['Philips FRx'],
    },
    {
      src: HS1_BACK,
      focus: { x: 0.3808, y: 0.8011, w: 0.1479, h: 0.135 },
      caption: 'The “SN” label at the bottom of the back panel.',
      kind: 'neutral',
      models: ['Philips HS1'],
    },
    {
      src: '/reference/zoll-aed-plus-back.jpg',
      focus: { x: 0.2524, y: 0.5678, w: 0.2635, h: 0.1186 },
      caption: 'The barcode label on the back, just below the handle.',
      kind: 'neutral',
      models: ['Zoll AED Plus'],
    },
  ],

  // The two Philips units take different pads: the FRx uses SMART Pads II
  // (a grey case on a cable), the HS1 a clear cartridge that slides into the
  // front. Each owner is shown only their own.
  pads_expiry: [
    {
      src: FRX_PADS,
      focus: { x: 0.4648, y: 0.6642, w: 0.1148, h: 0.0667 },
      caption: 'SMART Pads II: the date beside the ⌛ on the label near the bottom of the case.',
      kind: 'neutral',
      models: ['Philips FRx'],
    },
    {
      src: '/reference/philips-hs1-pads.jpg',
      focus: { x: 0.4471, y: 0.6931, w: 0.115, h: 0.0668 },
      caption: 'Pads cartridge: the date beside the ⌛, just below the body diagram.',
      kind: 'neutral',
      models: ['Philips HS1'],
    },
    {
      src: '/reference/zoll-aed-plus-pads.jpg',
      focus: { x: 0.5152, y: 0.476, w: 0.1025, h: 0.048 },
      caption: 'CPR-D-padz box: the date beside the ⌛ on the front label.',
      kind: 'neutral',
      models: ['Zoll AED Plus'],
    },
  ],

  battery_expiry: [
    {
      src: FRX_BACK,
      focus: { x: 0.1556, y: 0.3529, w: 0.1088, h: 0.2794 },
      caption: 'The label on the battery: use the “Install before” date.',
      kind: 'neutral',
      models: ['Philips FRx'],
    },
    {
      src: HS1_BACK,
      focus: { x: 0.1041, y: 0.3321, w: 0.1301, h: 0.3139 },
      caption: 'The label on the battery: use the install-before date, not the factory date.',
      kind: 'neutral',
      models: ['Philips HS1'],
    },
  ],

  battery_attached: [
    {
      src: FRX_BACK,
      focus: { x: 0.1364, y: 0.1507, w: 0.259, h: 0.7169 },
      caption: 'Battery pushed fully into the back, flush with the case.',
      kind: 'good',
      models: ['Philips FRx'],
    },
    {
      src: HS1_BACK,
      focus: { x: 0.0877, y: 0.1277, w: 0.2959, h: 0.7646 },
      caption: 'Battery pushed fully into the back, flush with the case.',
      kind: 'good',
      models: ['Philips HS1'],
    },
    {
      src: '/reference/zoll-aed-plus-battery-fitted.jpg',
      focus: { x: 0.0345, y: 0.0879, w: 0.931, h: 0.7908 },
      caption: 'All ten cells seated in the battery well.',
      kind: 'good',
      models: ['Zoll AED Plus'],
    },
    {
      src: '/reference/zoll-aed-plus-battery-missing.jpg',
      focus: { x: 0.0879, y: 0.3191, w: 0.8339, h: 0.434 },
      caption: 'Battery well empty. This needs fixing.',
      kind: 'bad',
      models: ['Zoll AED Plus'],
    },
  ],

  pads_connected: [
    {
      src: FRX_PADS,
      focus: { x: 0.487, y: 0.8494, w: 0.1722, h: 0.1333 },
      caption: 'This blue plug must be pushed firmly into the AED’s pads socket.',
      kind: 'neutral',
      models: ['Philips FRx'],
    },
    {
      src: HS1_FRONT,
      focus: { x: 0.274, y: 0.0312, w: 0.4989, h: 0.8693 },
      caption: 'Pads cartridge clicked flat into the front of the unit.',
      kind: 'good',
      models: ['Philips HS1'],
    },
    {
      src: ZOLL_FRONT,
      focus: { x: 0.5205, y: 0.4182, w: 0.0545, h: 0.1697 },
      caption: 'Pads cable plugged into its socket.',
      kind: 'good',
      models: ['Zoll AED Plus'],
    },
    {
      src: '/reference/zoll-aed-plus-pads-unplugged.jpg',
      focus: { x: 0.2739, y: 0.5177, w: 0.0665, h: 0.1383 },
      caption: 'Socket empty, pads not plugged in. This needs fixing.',
      kind: 'bad',
      models: ['Zoll AED Plus'],
    },
  ],

  // True of either Philips HeartStart: the small status light sits just
  // above the power button, whichever pads the unit carries.
  readiness_indicator: [
    {
      src: HS1_FRONT,
      focus: { x: 0.7878, y: 0.108, w: 0.0597, h: 0.1364 },
      caption: 'The small light just above the power button, not the button itself. HS1 shown.',
      kind: 'neutral',
      models: PHILIPS,
    },
    {
      src: ZOLL_FRONT,
      focus: { x: 0.5659, y: 0.7667, w: 0.0682, h: 0.0576 },
      caption: 'The status window on the handle, to the left of the power button.',
      kind: 'neutral',
      models: ['Zoll AED Plus'],
    },
  ],

  child_key_pad: [
    {
      src: '/reference/philips-frx-child-key.jpg',
      caption: 'The infant/child key: a blue key with a pink ring.',
      kind: 'neutral',
      models: ['Philips FRx'],
    },
  ],

  aed_cabinet: [
    { src: '/reference/aed-cabinet.jpg', caption: 'Wall cabinet, door closed, clearly signed.', kind: 'good' },
  ],

  first_response_kit: [
    {
      src: '/reference/rescue-kit.jpg',
      caption: 'Rescue kit pouch, with gloves, razor, scissors and mask inside.',
      kind: 'good',
    },
  ],

  // Brand-agnostic, so an illustration rather than a photo of one site's sticker.
  emergency_contacts: [
    {
      src: '/reference/emergency-contacts.svg',
      focus: { x: 0.3742, y: 0.6056, w: 0.2533, h: 0.19 },
      caption: 'A sticker with the emergency and site contact numbers, on the AED or its cabinet.',
      kind: 'neutral',
    },
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

/**
 * Warms the browser cache with every reference image this model's checks
 * will show, once the page is idle. The next check's example is then on
 * screen instantly — on a stairwell connection, the difference between a
 * picture and an empty grey box.
 */
export function preloadReferenceImages(aedModel?: string): () => void {
  if (typeof window === 'undefined') return () => {};
  const srcs = new Set<string>();
  for (const list of Object.values(REFERENCE_EXAMPLES)) {
    for (const ex of list ?? []) {
      if (!aedModel || !ex.models || ex.models.includes(aedModel)) srcs.add(ex.src);
    }
  }
  const load = () => {
    for (const src of srcs) {
      const img = new window.Image();
      img.decoding = 'async';
      img.src = src;
    }
  };
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(load, { timeout: 3000 });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(load, 1200);
  return () => window.clearTimeout(id);
}
