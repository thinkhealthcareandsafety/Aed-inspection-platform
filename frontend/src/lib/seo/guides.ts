/** The guides at /guides/[slug], for navigation and the sitemap. Each page's
 *  own file holds its content; this is only what other pages link with. */
export interface GuideEntry {
  slug: string;
  /** The <title>: written for the search result, 60 characters or so. */
  title: string;
  /** The page's own heading and the link text elsewhere. */
  heading: string;
  /** One line under a link to it. */
  blurb: string;
  description: string;
}

export const GUIDES: GuideEntry[] = [
  {
    slug: 'aed-inspection-checklist',
    title: 'AED Inspection Checklist: The 10 Monthly Checks (Free)',
    heading: 'AED inspection checklist',
    blurb: 'The ten things to check every month, and what a pass looks like.',
    description:
      'A free AED inspection checklist: the 10 checks to do every month, from the readiness light to pads and battery expiry, with what a pass looks like for each.',
  },
  {
    slug: 'aed-status-light',
    title: 'AED Status Light: What Green, Red and Blinking Mean',
    heading: 'What your AED’s status light means',
    blurb: 'Green, red, blinking or a ✗: model by model.',
    description:
      'What the readiness indicator on your AED means, model by model: blinking green, a green tick, a red X or a red light on Philips, ZOLL, Powerheart and Defibtech AEDs.',
  },
  {
    slug: 'aed-pads-expiry',
    title: 'AED Pads Expiry: Where the Date Is and When to Replace',
    heading: 'AED pads expiry',
    blurb: 'Where the date is printed, and when pads must be replaced.',
    description:
      'How to check AED pads expiry: where the date is printed on Philips, ZOLL, Powerheart and Defibtech pads, why expired pads are a risk, and when to replace them.',
  },
  {
    slug: 'aed-battery-expiry',
    title: 'AED Battery Expiry: How to Check the Date and Replace It',
    heading: 'AED battery expiry',
    blurb: 'Where each battery’s date is, and what it really means.',
    description:
      'How to check an AED battery: where the date is on each model, what “install before” and “date of manufacture” labels mean, and when to replace the battery.',
  },
  {
    slug: 'how-old-is-my-aed',
    title: 'How Old Is My AED? Read Its Age From the Serial Number',
    heading: 'How old is my AED?',
    blurb: 'Read the year it was made from its serial number.',
    description:
      'How to tell how old an AED is from its serial number: decoding Philips FRx and HS1, ZOLL AED Plus and AED 3 serials, and where Powerheart and Defibtech print the date.',
  },
];

export function guideEntry(slug: string): GuideEntry {
  const g = GUIDES.find((x) => x.slug === slug);
  if (!g) throw new Error(`Unknown guide: ${slug}`);
  return g;
}
