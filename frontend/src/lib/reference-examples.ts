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
  /** The same caption in Hindi. */
  captionHi: string;
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
  /**
   * A drawing, not a photo — labelled as such on screen. Used only where no
   * genuine photo exists, and drawn from the manufacturer's own description
   * of the part; details that couldn't be verified (a pack's colour) are
   * left neutral rather than guessed.
   */
  illustration?: boolean;
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
// Product shots, re-framed to the 4:3 white frame above.
const AED3_FRONT = '/reference/zoll-aed3-front.jpg';
const G3_FRONT = '/reference/powerheart-g3-front.jpg';
const G5_FRONT = '/reference/powerheart-g5-front.jpg';

export const REFERENCE_EXAMPLES: Partial<Record<ChecklistItemId, ReferenceExample[]>> = {
  serial_number: [
    {
      src: FRX_BACK,
      focus: { x: 0.3898, y: 0.7757, w: 0.1405, h: 0.1195 },
      caption: 'The “SN” label at the bottom of the back panel.',
      captionHi: 'पीछे वाले पैनल के नीचे लगा “SN” लेबल।',
      kind: 'neutral',
      models: ['Philips FRx'],
    },
    {
      src: HS1_BACK,
      focus: { x: 0.3808, y: 0.8011, w: 0.1479, h: 0.135 },
      caption: 'The “SN” label at the bottom of the back panel.',
      captionHi: 'पीछे वाले पैनल के नीचे लगा “SN” लेबल।',
      kind: 'neutral',
      models: ['Philips HS1'],
    },
    {
      src: '/reference/zoll-aed-plus-back.jpg',
      focus: { x: 0.2524, y: 0.5678, w: 0.2635, h: 0.1186 },
      caption: 'The barcode label on the back, just below the handle.',
      captionHi: 'पीछे, हैंडल के ठीक नीचे लगा बारकोड लेबल।',
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
      captionHi: 'SMART Pads II: केस के नीचे लगे लेबल पर ⌛ के पास छपी तारीख।',
      kind: 'neutral',
      models: ['Philips FRx'],
    },
    {
      src: '/reference/philips-hs1-pads.jpg',
      focus: { x: 0.4471, y: 0.6931, w: 0.115, h: 0.0668 },
      caption: 'Pads cartridge: the date beside the ⌛, just below the body diagram.',
      captionHi: 'पैड्स कार्ट्रिज: शरीर वाली तस्वीर के ठीक नीचे, ⌛ के पास छपी तारीख।',
      kind: 'neutral',
      models: ['Philips HS1'],
    },
    {
      src: '/reference/zoll-aed-plus-pads.jpg',
      focus: { x: 0.5152, y: 0.476, w: 0.1025, h: 0.048 },
      caption: 'CPR-D-padz box: the date beside the ⌛ on the front label.',
      captionHi: 'CPR-D-padz डिब्बा: आगे के लेबल पर ⌛ के पास छपी तारीख।',
      kind: 'neutral',
      models: ['Zoll AED Plus'],
    },
    {
      src: G3_FRONT,
      focus: { x: 0.448, y: 0.49, w: 0.115, h: 0.05 },
      caption: 'The pads’ date beside the ⌛, seen through the clear lid.',
      captionHi: 'पारदर्शी ढक्कन से दिखती, ⌛ के पास छपी पैड्स की तारीख।',
      kind: 'neutral',
      models: ['Zoll Powerheart G3'],
    },
    {
      src: G5_FRONT,
      focus: { x: 0.405, y: 0.428, w: 0.125, h: 0.055 },
      caption: 'The expiry window on the lid: the pads’ date shows here.',
      captionHi: 'ढक्कन पर एक्सपायरी विंडो: पैड्स की तारीख यहाँ दिखती है।',
      kind: 'neutral',
      models: ['Zoll Powerheart G5'],
    },
  ],

  battery_expiry: [
    {
      src: FRX_BACK,
      focus: { x: 0.1556, y: 0.3529, w: 0.1088, h: 0.2794 },
      caption: 'The label on the battery: use the “Install before” date.',
      captionHi: 'बैटरी पर लगा लेबल: “Install before” वाली तारीख देखें।',
      kind: 'neutral',
      models: ['Philips FRx'],
    },
    {
      src: HS1_BACK,
      focus: { x: 0.1041, y: 0.3321, w: 0.1301, h: 0.3139 },
      caption: 'The label on the battery: use the install-before date, not the factory date.',
      captionHi: 'बैटरी पर लगा लेबल: install-before वाली तारीख देखें, फ़ैक्टरी वाली नहीं।',
      kind: 'neutral',
      models: ['Philips HS1'],
    },
    // Per ZOLL's battery-label instructions: the replacement date is
    // written on a label stuck directly below the Status Indicator.
    {
      src: '/reference/zoll-aed-plus-battery-label.svg',
      focus: { x: 0.0867, y: 0.4267, w: 0.41, h: 0.1667 },
      caption: 'The “Replace batteries on or before” label, stuck just below the status window.',
      captionHi: 'स्टेटस विंडो के ठीक नीचे चिपका “Replace batteries on or before” लेबल।',
      kind: 'neutral',
      models: ['Zoll AED Plus'],
      illustration: true,
    },
  ],

  battery_attached: [
    {
      src: FRX_BACK,
      focus: { x: 0.1364, y: 0.1507, w: 0.259, h: 0.7169 },
      caption: 'Battery pushed fully into the back, flush with the case.',
      captionHi: 'बैटरी पीछे पूरी अंदर तक लगी है, केस के बराबर।',
      kind: 'good',
      models: ['Philips FRx'],
    },
    {
      src: HS1_BACK,
      focus: { x: 0.0877, y: 0.1277, w: 0.2959, h: 0.7646 },
      caption: 'Battery pushed fully into the back, flush with the case.',
      captionHi: 'बैटरी पीछे पूरी अंदर तक लगी है, केस के बराबर।',
      kind: 'good',
      models: ['Philips HS1'],
    },
    {
      src: '/reference/zoll-aed-plus-battery-fitted.jpg',
      focus: { x: 0.0345, y: 0.0879, w: 0.931, h: 0.7908 },
      caption: 'All ten cells seated in the battery well.',
      captionHi: 'बैटरी खाने में सभी दस सेल ठीक से लगे हैं।',
      kind: 'good',
      models: ['Zoll AED Plus'],
    },
    {
      src: '/reference/zoll-aed-plus-battery-missing.jpg',
      focus: { x: 0.0879, y: 0.3191, w: 0.8339, h: 0.434 },
      caption: 'Battery well empty. This needs fixing.',
      captionHi: 'बैटरी खाना खाली है। इसे ठीक करना होगा।',
      kind: 'bad',
      models: ['Zoll AED Plus'],
    },
  ],

  pads_connected: [
    {
      src: FRX_PADS,
      focus: { x: 0.487, y: 0.8494, w: 0.1722, h: 0.1333 },
      caption: 'This blue plug must be pushed firmly into the AED’s pads socket.',
      captionHi: 'यह नीला प्लग AED के पैड्स सॉकेट में पूरा, मज़बूती से लगा होना चाहिए।',
      kind: 'neutral',
      models: ['Philips FRx'],
    },
    {
      src: HS1_FRONT,
      focus: { x: 0.274, y: 0.0312, w: 0.4989, h: 0.8693 },
      caption: 'Pads cartridge clicked flat into the front of the unit.',
      captionHi: 'पैड्स कार्ट्रिज मशीन के आगे पूरी तरह बैठा हुआ।',
      kind: 'good',
      models: ['Philips HS1'],
    },
    {
      src: ZOLL_FRONT,
      focus: { x: 0.5205, y: 0.4182, w: 0.0545, h: 0.1697 },
      caption: 'Pads cable plugged into its socket.',
      captionHi: 'पैड्स की केबल अपने सॉकेट में लगी है।',
      kind: 'good',
      models: ['Zoll AED Plus'],
    },
    {
      src: '/reference/zoll-aed-plus-pads-unplugged.jpg',
      focus: { x: 0.2739, y: 0.5177, w: 0.0665, h: 0.1383 },
      caption: 'Socket empty, pads not plugged in. This needs fixing.',
      captionHi: 'सॉकेट खाली है, पैड्स नहीं लगे। इसे ठीक करना होगा।',
      kind: 'bad',
      models: ['Zoll AED Plus'],
    },
    {
      src: AED3_FRONT,
      focus: { x: 0.64, y: 0.12, w: 0.06, h: 0.28 },
      caption: 'Pads cable plugged into its socket at the top right.',
      captionHi: 'ऊपर दाईं ओर, सॉकेट में लगी पैड्स की केबल।',
      kind: 'good',
      models: ['Zoll AED 3'],
    },
  ],

  // True of either Philips HeartStart: the small status light sits just
  // above the power button, whichever pads the unit carries.
  readiness_indicator: [
    {
      src: HS1_FRONT,
      // The Ready light itself — the small oval above the button, which the
      // ring used to take in along with the button it says not to film.
      focus: { x: 0.797, y: 0.1056, w: 0.04, h: 0.05 },
      caption: 'The small green Ready light beside the power button, not the button itself. HS1 shown.',
      captionHi: 'पावर बटन के पास की छोटी हरी Ready लाइट, बटन खुद नहीं। तस्वीर में HS1 है।',
      kind: 'neutral',
      models: PHILIPS,
    },
    {
      src: ZOLL_FRONT,
      focus: { x: 0.5659, y: 0.7667, w: 0.0682, h: 0.0576 },
      caption: 'The status window on the handle, to the left of the power button.',
      captionHi: 'हैंडल पर, पावर बटन के बाईं ओर की स्टेटस विंडो।',
      kind: 'neutral',
      models: ['Zoll AED Plus'],
    },
    {
      src: AED3_FRONT,
      focus: { x: 0.362, y: 0.158, w: 0.07, h: 0.062 },
      caption: 'The small status window just right of the power button: a green ✓ means ready.',
      captionHi: 'पावर बटन के ठीक दाईं ओर की छोटी स्टेटस विंडो: हरा ✓ मतलब तैयार।',
      kind: 'neutral',
      models: ['Zoll AED 3'],
    },
    {
      src: G3_FRONT,
      focus: { x: 0.68, y: 0.1, w: 0.065, h: 0.11 },
      caption: 'The round Rescue Ready light beside the handle: green is ready, red needs attention.',
      captionHi: 'हैंडल के पास की गोल Rescue Ready लाइट: हरी मतलब तैयार, लाल मतलब जाँच ज़रूरी।',
      kind: 'neutral',
      models: ['Zoll Powerheart G3'],
    },
    {
      src: G5_FRONT,
      focus: { x: 0.543, y: 0.19, w: 0.08, h: 0.1 },
      caption: 'The round Rescue Ready light beside the handle: green is ready, red needs attention.',
      captionHi: 'हैंडल के पास की गोल Rescue Ready लाइट: हरी मतलब तैयार, लाल मतलब जाँच ज़रूरी।',
      kind: 'neutral',
      models: ['Zoll Powerheart G5'],
    },
  ],

  // Each unit handles children differently: the FRx takes a key, the HS1 a
  // separate pads cartridge, the AED Plus a separate pack of pads, the AED 3
  // a Child button that turns its CPR Uni-padz into child pads.
  child_key_pad: [
    {
      src: '/reference/philips-frx-child-key.jpg',
      caption: 'The infant/child key: a blue key with a pink ring.',
      captionHi: 'इन्फ़ैंट/चाइल्ड Key: गुलाबी रिंग वाली नीली Key।',
      kind: 'neutral',
      models: ['Philips FRx'],
    },
    {
      src: '/reference/philips-hs1-child-pads.svg',
      focus: { x: 0.3883, y: 0.5556, w: 0.2233, h: 0.1911 },
      caption: 'An infant/child pads cartridge: look for the teddy bear and the weight limit.',
      captionHi: 'इन्फ़ैंट/चाइल्ड पैड्स कार्ट्रिज: टेडी बियर का निशान और वज़न की सीमा देखें।',
      kind: 'neutral',
      models: ['Philips HS1'],
      illustration: true,
    },
    {
      src: '/reference/zoll-aed-plus-child-pads.svg',
      caption: 'Pedi-padz II: a separate pack of child pads, with child placement diagrams.',
      captionHi: 'Pedi-padz II: बच्चों के पैड्स का अलग पैकेट, जिस पर उन्हें लगाने की तस्वीरें हैं।',
      kind: 'neutral',
      models: ['Zoll AED Plus'],
      illustration: true,
    },
    {
      src: AED3_FRONT,
      focus: { x: 0.53, y: 0.62, w: 0.11, h: 0.155 },
      caption: 'The Child button: with CPR Uni-padz, it is pressed for a child under 8 or 25 kg.',
      captionHi: 'Child बटन: CPR Uni-padz के साथ, 8 साल या 25 किलो से कम के बच्चे के लिए इसे दबाया जाता है।',
      kind: 'neutral',
      models: ['Zoll AED 3'],
    },
  ],

  aed_cabinet: [
    {
      src: '/reference/aed-cabinet.jpg',
      caption: 'Wall cabinet, door closed, clearly signed.',
      captionHi: 'दीवार पर लगा कैबिनेट: दरवाज़ा बंद, साफ़ निशान के साथ।',
      kind: 'good',
    },
  ],

  first_response_kit: [
    {
      src: '/reference/rescue-kit.jpg',
      caption: 'Rescue kit pouch, with gloves, razor, scissors and mask inside.',
      captionHi: 'रेस्क्यू किट का पाउच, जिसमें दस्ताने, रेज़र, कैंची और मास्क हों।',
      kind: 'good',
    },
  ],

  // Brand-agnostic, so an illustration rather than a photo of one site's sticker.
  emergency_contacts: [
    {
      src: '/reference/emergency-contacts.svg',
      focus: { x: 0.3742, y: 0.6056, w: 0.2533, h: 0.19 },
      caption: 'A sticker with the emergency and site contact numbers, on the AED or its cabinet.',
      captionHi: 'इमरजेंसी और साइट के संपर्क नंबरों वाला स्टिकर, AED या उसके कैबिनेट पर।',
      kind: 'neutral',
      illustration: true,
    },
  ],
};

/** An example's caption in the language showing. */
export function captionOf(example: ReferenceExample, lang: string): string {
  return lang === 'hi' ? example.captionHi : example.caption;
}

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
