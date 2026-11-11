/**
 * The model guides at /aed/[slug]: how to inspect each AED the app covers,
 * written for someone standing in front of one.
 *
 * Every placement here (where the light is, where each date is printed) comes
 * from the app's own per-model instructions in i18n/en.tsx, which were checked
 * against each maker's manual and real units, and the dating rules from
 * lib/device-age.ts. Keep them in step: a guide that says the label is on the
 * back while the app says underneath loses the reader's trust in both.
 * No service lives or prices are stated per model: the date on the label is
 * what counts, and that is what the guides send people to read.
 */
import { DEVICE_PHOTO } from '@/lib/device-photos';

export interface ModelGuide {
  slug: string;
  /** The app's model id, for the "Inspect my AED" link. */
  id: string;
  fullName: string;
  /** Short name for buttons and cards: "FRx", "AED Plus". */
  shortName: string;
  maker: string;
  /** Another name the same unit is sold or searched under. */
  aka?: string;
  photo: string;
  title: string;
  description: string;
  identify: string;
  readiness: { where: string; ready: string; notReady: string; tip?: string };
  serial: { where: string; age: string };
  pads: { name: string; where: string };
  battery: { where: string; note?: string };
  batteryFitted: string;
  padsConnected: string;
  child: string;
  faqs: { q: string; a: string }[];
}

const photo = (id: string) => DEVICE_PHOTO[id]?.large ?? '/devices/frx-lg.webp';

const PHILIPS_AGE = (example: string, made: string) =>
  `Philips puts the year and month in the serial number: after the first letter come two digits for the year, then a letter for the month (A is January, L is December). “${example}” was made in ${made}.`;

const POWERHEART_TIP =
  'Touching or opening the lid can turn the light red for about five seconds. Leave it alone for a moment, then look again.';

const DEFIBTECH_BACK_SERIAL =
  'Slide the pads package out of its holder on the back (leave it plugged in). The 9-digit serial label is behind it. Slide the pads back afterwards.';

const DEFIBTECH_NO_DATE =
  'Defibtech serial numbers don’t contain a date, so look for a date of manufacture on the label instead.';

const DEFIBTECH_STATUS_SCREEN =
  'With the AED switched off, press the middle button beside the screen. The status screen shows the serial number and the battery and pads dates, which on the unit itself face inwards.';

export const MODEL_GUIDES: ModelGuide[] = [
  {
    slug: 'philips-heartstart-frx',
    id: 'Philips FRx',
    fullName: 'Philips HeartStart FRx',
    shortName: 'FRx',
    maker: 'Philips',
    photo: photo('Philips FRx'),
    title: 'Philips HeartStart FRx Inspection: Ready Light, Pads, Battery',
    description:
      'How to check a Philips HeartStart FRx: what the green Ready light should do, where the SMART Pads II and battery dates are, and how to tell its age from the serial.',
    identify: 'Blue-grey, often kept in a red carry case. “HeartStart FRx” is printed on the front.',
    readiness: {
      where: 'the small green Ready light, not the green On/Off button',
      ready: 'It blinks green every few seconds. There can be a gap of a few seconds between blinks, so watch for a full 10 seconds before deciding.',
      notReady: 'No blink in 10 seconds, or the AED chirping, means it needs attention.',
    },
    serial: {
      where: 'The small “SN” label at the bottom of the back panel.',
      age: PHILIPS_AGE('B17C-00516', 'March 2017'),
    },
    pads: {
      name: 'SMART Pads II',
      where: 'On the grey SMART Pads II case: the small label near the bottom, with the date beside the ⌛ symbol.',
    },
    battery: {
      where: 'On the blue battery at the back: the “Install before” date.',
      note: 'The “Install before” date is for a spare still in its packaging: don’t fit one that is past it. Once fitted, the AED’s own self-tests keep watch on it.',
    },
    batteryFitted: 'The blue battery should sit fully in and flush with the back of the AED.',
    padsConnected:
      'The blue pads plug should be pushed fully into the pads socket. The FRx keeps its pads plugged in, so they’re ready the moment it’s opened.',
    child:
      'The FRx uses an infant/child key for children under 8 or under 25 kg. Keep it beside the AED, not left in its slot.',
    faqs: [
      {
        q: 'Why is my Philips FRx chirping?',
        a: 'A chirp means the FRx needs attention, most often a low battery or a failed self-test. Check that the green Ready light is blinking, that the battery is in date and fully fitted, and that the pads are plugged in. If it keeps chirping, contact your supplier.',
      },
      {
        q: 'How do I know my Philips FRx is ready to use?',
        a: 'The small green Ready light blinks every few seconds. Watch it for 10 seconds: if it blinks, the FRx has passed its self-test. If it doesn’t, it needs attention.',
      },
      {
        q: 'How old is my Philips FRx?',
        a: 'Read the serial on the “SN” label at the bottom of the back. The two digits after the first letter are the year it was made, and the letter after them is the month: “B17C-00516” is March 2017.',
      },
    ],
  },
  {
    slug: 'philips-heartstart-hs1',
    id: 'Philips HS1',
    fullName: 'Philips HeartStart HS1',
    shortName: 'HS1',
    maker: 'Philips',
    aka: 'Sold in the US as the HeartStart OnSite',
    photo: photo('Philips HS1'),
    title: 'Philips HeartStart HS1 (OnSite) Inspection: Ready Light, Pads',
    description:
      'How to check a Philips HeartStart HS1 / OnSite AED: the green Ready light, the pads cartridge date, the battery date, and its age from the serial number.',
    identify: 'Deeper blue and upright, with a carry strap. The pads cartridge slides into the front.',
    readiness: {
      where: 'the small green Ready light at the top right, not the green On/Off button',
      ready: 'It blinks green every few seconds. Watch it for a full 10 seconds before deciding.',
      notReady: 'No blink in 10 seconds, or the AED chirping, means it needs attention.',
    },
    serial: {
      where: 'The small “SN” label at the bottom of the back panel.',
      age: PHILIPS_AGE('A18A-06336', 'January 2018'),
    },
    pads: {
      name: 'pads cartridge',
      where: 'On the pads cartridge, just below the body diagram, beside the ⌛ symbol.',
    },
    battery: {
      where: 'On the blue battery at the back: the install-before date.',
      note: 'That date is for a spare still in its packaging: don’t fit one that is past it. A fitted battery is watched by the AED’s self-tests.',
    },
    batteryFitted: 'The blue battery should sit fully in and flush with the back of the AED.',
    padsConnected: 'The pads cartridge should be fitted in the front, with its green PULL handle down.',
    child:
      'Infant/child pads come as a separate cartridge, marked with a teddy-bear icon. Keep a spare if children could be present.',
    faqs: [
      {
        q: 'Is the Philips HS1 the same as the HeartStart OnSite?',
        a: 'Yes. Philips sells the same AED as the HeartStart OnSite in the US and the HeartStart HS1 elsewhere. The checks are identical.',
      },
      {
        q: 'Why is my Philips HS1 chirping?',
        a: 'A chirp means the AED needs attention, usually a low battery, a missing pads cartridge, or a failed self-test. Check the Ready light, the battery and the pads cartridge, and contact your supplier if it keeps chirping.',
      },
      {
        q: 'Where is the expiry date on HS1 pads?',
        a: 'On the pads cartridge itself, just below the body diagram, next to the ⌛ symbol.',
      },
    ],
  },
  {
    slug: 'zoll-aed-plus',
    id: 'Zoll AED Plus',
    fullName: 'ZOLL AED Plus',
    shortName: 'AED Plus',
    maker: 'ZOLL',
    photo: photo('Zoll AED Plus'),
    title: 'ZOLL AED Plus Inspection: Green Tick, Red X, Pads & Batteries',
    description:
      'How to check a ZOLL AED Plus: what the green ✓ and red ✗ in the status window mean, where the CPR-D-padz and battery dates are, and how old the unit is.',
    identify: 'Bright green, with the handle moulded into the top.',
    readiness: {
      where: 'the status window on the left of the handle',
      ready: 'A green ✓ (tick) in the window.',
      notReady:
        'A red ✗ means it is not ready: it failed a self-test, often because the batteries are low. It may also beep.',
    },
    serial: {
      where: 'The barcode label on the back, just below the handle.',
      age: 'ZOLL puts the year and month in the serial number: after the “X” come two digits for the year, then a letter for the month (A is January, L is December). “X14K718292” was made in November 2014.',
    },
    pads: {
      name: 'CPR-D-padz',
      where: 'On the pads pack or its box, beside the ⌛ symbol.',
    },
    battery: {
      where: 'The “Replace batteries on or before” label, just below the status window on the handle.',
      note: 'The AED Plus runs on ten lithium cells. Replace all ten together, never one at a time.',
    },
    batteryFitted:
      'The battery compartment cover on the back should be closed and latched, with all ten cells seated.',
    padsConnected: 'Lift the cover and check the pads cable is plugged into its socket.',
    child: 'ZOLL’s child pads are Pedi-padz II. Keep a spare pack if children could be present.',
    faqs: [
      {
        q: 'What does the red X on a ZOLL AED Plus mean?',
        a: 'The AED is not ready to use: it failed its self-test. Low batteries are a common cause. Replace all ten batteries together and check that the window shows a green ✓. If it still shows a red ✗, contact your supplier.',
      },
      {
        q: 'How do I know my ZOLL AED Plus is ready?',
        a: 'Look at the status window on the left of the handle. A green ✓ means it passed its last self-test and is ready.',
      },
      {
        q: 'Where is the battery date on a ZOLL AED Plus?',
        a: 'On the “Replace batteries on or before” label just below the status window, on the handle.',
      },
    ],
  },
  {
    slug: 'zoll-aed-3',
    id: 'Zoll AED 3',
    fullName: 'ZOLL AED 3',
    shortName: 'AED 3',
    maker: 'ZOLL',
    photo: photo('Zoll AED 3'),
    title: 'ZOLL AED 3 Inspection: Status Check, Pads & Battery Expiry',
    description:
      'How to check a ZOLL AED 3: the green ✓ status window, the CPR Uni-padz expiry date, the battery date, and how to read its age from the serial number.',
    identify: 'Lime green and upright, with a colour screen on the front.',
    readiness: {
      where: 'the small status window just right of the On/Off button',
      ready: 'A green ✓ (tick) in the window.',
      notReady: 'If the green ✓ isn’t showing, it needs attention.',
    },
    serial: {
      where: 'The serial number label on the back, just above the battery.',
      age: 'After its first letter “A”, the serial follows ZOLL’s pattern: “X”, two digits for the year, then a letter for the month (A is January, L is December). “AX19D…” was made in April 2019.',
    },
    pads: {
      name: 'CPR Uni-padz',
      where: 'On the pads package in the back of the AED, beside the ⌛ symbol.',
    },
    battery: { where: 'The white label on the battery at the back shows its install-by date.' },
    batteryFitted: 'The battery should be clicked in, flush with the case at the back.',
    padsConnected: 'The pads cable should be plugged into its socket at the top right of the front.',
    child:
      'CPR Uni-padz are used for children as well as adults, so most AED 3 owners don’t need separate child pads. ZOLL’s Pedi-padz II are also available.',
    faqs: [
      {
        q: 'How do I know my ZOLL AED 3 is ready?',
        a: 'The small status window just right of the On/Off button shows a green ✓ when the AED has passed its self-test.',
      },
      {
        q: 'Does the ZOLL AED 3 need child pads?',
        a: 'Usually not. Its CPR Uni-padz are used for adults and children alike. Check the label on your pads package to be sure.',
      },
      {
        q: 'Where is the pads expiry date on a ZOLL AED 3?',
        a: 'On the pads package, stored in the back of the AED, beside the ⌛ symbol.',
      },
    ],
  },
  {
    slug: 'powerheart-g3',
    id: 'Zoll Powerheart G3',
    fullName: 'Cardiac Science Powerheart G3',
    shortName: 'Powerheart G3',
    maker: 'Cardiac Science (now ZOLL)',
    aka: 'Made by Cardiac Science, now part of ZOLL',
    photo: photo('Zoll Powerheart G3'),
    title: 'Powerheart G3 Inspection: Rescue Ready Light, Pads & Battery',
    description:
      'How to check a Cardiac Science Powerheart G3: the Rescue Ready light (green or red), the pads date through the lid, the battery label and the serial number.',
    identify: 'Navy and yellow, with a clear lid over the pads.',
    readiness: {
      where: 'the round Rescue Ready light beside the handle, with the lid closed',
      ready: 'Green.',
      notReady: 'Red means it needs attention. The AED may also beep.',
      tip: POWERHEART_TIP,
    },
    serial: {
      where: 'Turn the AED over: the number beside “SN”, on the label on the underside.',
      age: 'The serial number carries no date. The manufacture date is printed beside the factory symbol on the same label.',
    },
    pads: {
      name: 'pads',
      where: 'Seen through the clear lid, beside the ⌛ symbol. There’s no need to open it.',
    },
    battery: {
      where: 'Lift the battery out of the bottom of the AED and read its label, then press it back until it clicks.',
      note: 'The label shows the date the battery was made, not an expiry date.',
    },
    batteryFitted: 'Turn the AED over: the battery should be pushed fully in and flush.',
    padsConnected:
      'Open the lid and check the pads connector is plugged into its socket. The AED switches on and talks when the lid opens; that’s normal. Close the lid afterwards.',
    child: 'Keep a spare pack of child (paediatric) pads if children could be present.',
    faqs: [
      {
        q: 'Why is the Rescue Ready light red on my Powerheart G3?',
        a: 'Red means the AED needs attention, often the battery or the pads. If the lid was just touched, wait about five seconds: it can show red briefly. If it stays red, check the battery and pads, and contact your supplier.',
      },
      {
        q: 'Is the Powerheart G3 a ZOLL or a Cardiac Science AED?',
        a: 'Both: Cardiac Science made the Powerheart line, and ZOLL now owns it. You’ll find either name on the unit.',
      },
      {
        q: 'How old is my Powerheart G3?',
        a: 'The serial number doesn’t say. Look for the manufacture date beside the factory symbol on the serial label under the AED.',
      },
    ],
  },
  {
    slug: 'powerheart-g5',
    id: 'Zoll Powerheart G5',
    fullName: 'Cardiac Science Powerheart G5',
    shortName: 'Powerheart G5',
    maker: 'Cardiac Science (now ZOLL)',
    aka: 'Made by Cardiac Science, now part of ZOLL',
    photo: photo('Zoll Powerheart G5'),
    title: 'Powerheart G5 Inspection: Rescue Ready Light, Pads & Battery',
    description:
      'How to check a Powerheart G5: what the green or red Rescue Ready light means, where the pads expiry window is, and how to check the battery and serial.',
    identify: 'Orange and upright, with a round Rescue Ready light by the handle.',
    readiness: {
      where: 'the round Rescue Ready light beside the handle, with the lid closed',
      ready: 'Green.',
      notReady: 'Red means it needs attention. The AED may also beep.',
      tip: POWERHEART_TIP,
    },
    serial: {
      where: 'The number beside “SN”, on the label on the back of the AED.',
      age: 'The serial number carries no date. The manufacture date is printed beside the factory symbol on the same label.',
    },
    pads: {
      name: 'pads',
      where: 'In the small expiry window on the front of the lid.',
    },
    battery: {
      where: 'Lift the battery out of the bottom of the AED and read its label, then press it back until it clicks.',
      note: 'The label shows the date the battery was made, not an expiry date.',
    },
    batteryFitted: 'Turn the AED over: the battery should be pushed fully in and flush.',
    padsConnected:
      'Open the lid and check the pads connector is plugged into its socket. The AED switches on and talks when the lid opens; that’s normal. Close the lid afterwards.',
    child: 'Keep a spare pack of child (paediatric) pads beside the AED, not plugged in.',
    faqs: [
      {
        q: 'Why is the Rescue Ready light red on my Powerheart G5?',
        a: 'Red means the AED needs attention, often the battery or the pads. If the lid was just touched, wait about five seconds: it can show red briefly. If it stays red, check the battery and pads, and contact your supplier.',
      },
      {
        q: 'Where is the pads expiry date on a Powerheart G5?',
        a: 'In the small expiry window on the front of the lid. You can read it without opening the AED.',
      },
      {
        q: 'How old is my Powerheart G5?',
        a: 'The serial number doesn’t say. Look for the manufacture date beside the factory symbol on the serial label on the back.',
      },
    ],
  },
  {
    slug: 'defibtech-lifeline',
    id: 'Defibtech Lifeline',
    fullName: 'Defibtech Lifeline',
    shortName: 'Lifeline',
    maker: 'Defibtech',
    photo: photo('Defibtech Lifeline'),
    title: 'Defibtech Lifeline AED Inspection: Status Light, Pads, Battery',
    description:
      'How to check a Defibtech Lifeline AED: the green status light, the pads and battery dates, whether both are fitted, and where the serial number is.',
    identify: 'Yellow with grey sides, no screen, and a red Shock button.',
    readiness: {
      where: 'the small light at the top-right corner, by the handle',
      ready: 'It flashes green about every 5 seconds. Watch for 10 seconds to see two flashes.',
      notReady: 'Red, or no green flash in 10 seconds, means it needs attention.',
    },
    serial: { where: DEFIBTECH_BACK_SERIAL, age: DEFIBTECH_NO_DATE },
    pads: {
      name: 'pads',
      where: 'Slide the pads package out of its holder on the back (leave it plugged in). The date is beside the ⌛ on the white label on its back. Slide it back afterwards.',
    },
    battery: {
      where: 'Press the orange eject button on the side and pull the battery out. The date is beside the ⌛ on its label. Slide it back in until it clicks.',
    },
    batteryFitted: 'On the side, the battery should be pushed fully in and flush, beside the orange eject button.',
    padsConnected: 'The pads connector plugs into a socket at the top-left corner, by the handle.',
    child: 'Child/infant pads have a blue connector. Keep a spare pack if children could be present.',
    faqs: [
      {
        q: 'How do I know my Defibtech Lifeline is ready?',
        a: 'The small light at the top-right corner, by the handle, flashes green about every 5 seconds. Watch it for 10 seconds.',
      },
      {
        q: 'Why is the light red on my Defibtech Lifeline?',
        a: 'A red light means the AED needs attention, usually the battery or the pads. Check both are in date and fitted, and contact your supplier if it stays red.',
      },
      {
        q: 'Where is the serial number on a Defibtech Lifeline?',
        a: 'Behind the pads package on the back. Slide the package out of its holder, leaving it plugged in, to see the 9-digit serial label.',
      },
    ],
  },
  {
    slug: 'defibtech-lifeline-auto',
    id: 'Defibtech Lifeline AUTO',
    fullName: 'Defibtech Lifeline AUTO',
    shortName: 'Lifeline AUTO',
    maker: 'Defibtech',
    photo: photo('Defibtech Lifeline AUTO'),
    title: 'Lifeline AUTO AED Inspection: Status Light, Pads & Battery',
    description:
      'How to check a Defibtech Lifeline AUTO: the green status light, where the pads and battery dates are, and how to find the serial number.',
    identify: 'Yellow with grey sides and no screen. It has no Shock button: an “auto” symbol instead, because it shocks automatically.',
    readiness: {
      where: 'the small light at the top-right corner, by the handle',
      ready: 'It flashes green about every 5 seconds. Watch for 10 seconds to see two flashes.',
      notReady: 'Red, or no green flash in 10 seconds, means it needs attention.',
    },
    serial: { where: DEFIBTECH_BACK_SERIAL, age: DEFIBTECH_NO_DATE },
    pads: {
      name: 'pads',
      where: 'Slide the pads package out of its holder on the back (leave it plugged in). The date is beside the ⌛ on the white label on its back. Slide it back afterwards.',
    },
    battery: {
      where: 'Press the orange eject button on the side and pull the battery out. The date is beside the ⌛ on its label. Slide it back in until it clicks.',
    },
    batteryFitted: 'On the side, the battery should be pushed fully in and flush, beside the orange eject button.',
    padsConnected: 'The pads connector plugs into a socket at the top-left corner, by the handle.',
    child: 'Child/infant pads have a blue connector. Keep a spare pack if children could be present.',
    faqs: [
      {
        q: 'How is the Lifeline AUTO different from the Lifeline?',
        a: 'The AUTO is fully automatic: it has no Shock button and delivers a shock itself when one is needed. The checks are the same as for the Lifeline.',
      },
      {
        q: 'How do I know my Lifeline AUTO is ready?',
        a: 'The small light at the top-right corner, by the handle, flashes green about every 5 seconds. Red means it needs attention.',
      },
    ],
  },
  {
    slug: 'defibtech-lifeline-view',
    id: 'Defibtech Lifeline VIEW',
    fullName: 'Defibtech Lifeline VIEW',
    shortName: 'Lifeline VIEW',
    maker: 'Defibtech',
    photo: photo('Defibtech Lifeline VIEW'),
    title: 'Lifeline VIEW AED Inspection: Status Screen, Pads & Battery',
    description:
      'How to check a Defibtech Lifeline VIEW: the green status light, and how to use its status screen to read the serial number and the battery and pads dates.',
    identify: 'Yellow, with a colour video screen and “Lifeline VIEW” on the front.',
    readiness: {
      where: 'the small light just right of the On/Off button',
      ready: 'It flashes green. Watch for 10 seconds.',
      notReady: 'Red, or no green flash in 10 seconds, means it needs attention.',
    },
    serial: {
      where: `${DEFIBTECH_STATUS_SCREEN} Read the “AED S/N” line, not “Battery S/N”. There is also an “SN” label at the top of the back (not the “REF” label beside it).`,
      age: DEFIBTECH_NO_DATE,
    },
    pads: { name: 'pads', where: 'On the same status screen: the “Pads status” line shows the expiry date.' },
    battery: { where: 'On the same status screen: the “Battery status” line shows the expiry date.' },
    batteryFitted: 'Turn the AED over: the battery at the top of the back should be pushed fully in and flush.',
    padsConnected: 'The pads connector plugs into a socket at the top-left corner, by the handle.',
    child: 'Keep a spare child/infant pads package (DDP-2002) if children could be present.',
    faqs: [
      {
        q: 'How do I see the battery and pads dates on a Lifeline VIEW?',
        a: 'With the AED switched off, press the middle button beside the screen. The status screen shows the “Battery status” and “Pads status” lines with their expiry dates, and the AED’s serial number.',
      },
      {
        q: 'How do I know my Lifeline VIEW is ready?',
        a: 'The small light just right of the On/Off button flashes green. Red means it needs attention.',
      },
    ],
  },
  {
    slug: 'defibtech-lifeline-ecg',
    id: 'Defibtech Lifeline ECG',
    fullName: 'Defibtech Lifeline ECG',
    shortName: 'Lifeline ECG',
    maker: 'Defibtech',
    photo: photo('Defibtech Lifeline ECG'),
    title: 'Lifeline ECG AED Inspection: Status Screen, Pads & Battery',
    description:
      'How to check a Defibtech Lifeline ECG: the green status light, and how to read the serial number and the battery and pads dates on its status screen.',
    identify: 'Like the Lifeline VIEW, with “Lifeline ECG” on the front. It can show a heart trace.',
    readiness: {
      where: 'the small light just right of the On/Off button',
      ready: 'It flashes green. Watch for 10 seconds.',
      notReady: 'Red, or no green flash in 10 seconds, means it needs attention.',
    },
    serial: {
      where: `${DEFIBTECH_STATUS_SCREEN} Read the “AED S/N” line, not “Battery S/N”. There is also an “SN” label at the top of the back (not the “REF” label beside it).`,
      age: DEFIBTECH_NO_DATE,
    },
    pads: { name: 'pads', where: 'On the same status screen: the “Pads status” line shows the expiry date.' },
    battery: { where: 'On the same status screen: the “Battery status” line shows the expiry date.' },
    batteryFitted: 'Turn the AED over: the battery at the top of the back should be pushed fully in and flush.',
    padsConnected: 'The pads connector plugs into a socket at the top-left corner, by the handle.',
    child: 'Keep a spare child/infant pads package (DDP-2002) if children could be present.',
    faqs: [
      {
        q: 'How is the Lifeline ECG different from the Lifeline VIEW?',
        a: 'They look and are checked the same way. The ECG model can also show a heart trace on its screen.',
      },
      {
        q: 'How do I see the battery and pads dates on a Lifeline ECG?',
        a: 'With the AED switched off, press the middle button beside the screen. The status screen shows both dates and the AED’s serial number.',
      },
    ],
  },
];

export function modelGuide(slug: string): ModelGuide | undefined {
  return MODEL_GUIDES.find((g) => g.slug === slug);
}

/** The app link that starts an inspection of this exact model. */
export function inspectHref(id: string): string {
  return `/?model=${encodeURIComponent(id)}`;
}

/** Brands the app helps with through its "My AED isn't listed" path. */
export const OTHER_BRANDS_LINE =
  'Mindray, Schiller, HeartSine, Physio-Control (LIFEPAK), Nihon Kohden and others';
