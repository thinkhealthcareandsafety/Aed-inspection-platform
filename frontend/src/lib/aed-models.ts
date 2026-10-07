export interface AedModelOption {
  id: string;
  name: string;
  brand: string;
  available: boolean;
  /** How to tell this unit apart while standing in front of it. Physical,
   *  checkable facts only — the model name is also printed on the device. */
  hint: string;
  /** How long to film the readiness indicator. A Philips Ready light blinks
   *  only every few seconds, so needs ten to be sure of catching one; a
   *  ZOLL status window reads in five; a Powerheart's indicator goes red for
   *  about five seconds after its lid is touched, so it gets ten too; a
   *  Defibtech status light flashes about every five, so ten catches two. */
  readinessSeconds: number;
}

// Keep in sync with backend/src/config/aed-models.ts
export const AED_MODEL_OPTIONS: AedModelOption[] = [
  {
    id: 'Philips FRx',
    name: 'HeartStart FRx',
    brand: 'Philips',
    available: true,
    hint: 'Blue-grey, often kept in a red carry case',
    readinessSeconds: 10,
  },
  {
    id: 'Philips HS1',
    name: 'HeartStart HS1',
    brand: 'Philips',
    available: true,
    hint: 'Deeper blue and upright, with a carry strap',
    readinessSeconds: 10,
  },
  {
    id: 'Zoll AED Plus',
    name: 'AED Plus',
    // As ZOLL writes it on the unit and in its manuals.
    brand: 'ZOLL',
    available: true,
    hint: 'Bright green, handle moulded into the top',
    readinessSeconds: 5,
  },
  {
    id: 'Zoll AED 3',
    name: 'AED 3',
    brand: 'ZOLL',
    available: true,
    hint: 'Lime green and upright, with a colour screen on the front',
    readinessSeconds: 5,
  },
  {
    id: 'Zoll Powerheart G3',
    name: 'Powerheart G3',
    // Sold as Cardiac Science; ZOLL makes the Powerheart line now.
    brand: 'ZOLL · Cardiac Science',
    available: true,
    hint: 'Navy and yellow, with a clear lid over the pads',
    readinessSeconds: 10,
  },
  {
    id: 'Zoll Powerheart G5',
    name: 'Powerheart G5',
    brand: 'ZOLL · Cardiac Science',
    available: true,
    hint: 'Orange and upright, with a round Rescue Ready light by the handle',
    readinessSeconds: 10,
  },
  // Defibtech's four, from the DDU-100 and DDU-2000 series manuals. All are
  // yellow with grey sides, so the hint is what tells them apart.
  {
    id: 'Defibtech Lifeline',
    name: 'Lifeline',
    brand: 'Defibtech',
    available: true,
    hint: 'Yellow, no screen, with a red Shock button',
    readinessSeconds: 10,
  },
  {
    id: 'Defibtech Lifeline AUTO',
    name: 'Lifeline AUTO',
    brand: 'Defibtech',
    available: true,
    hint: 'Yellow, no screen, and no Shock button: an “auto” symbol instead',
    readinessSeconds: 10,
  },
  {
    id: 'Defibtech Lifeline VIEW',
    name: 'Lifeline VIEW',
    brand: 'Defibtech',
    available: true,
    hint: 'Yellow, with a colour video screen; “Lifeline VIEW” on the front',
    readinessSeconds: 10,
  },
  {
    id: 'Defibtech Lifeline ECG',
    name: 'Lifeline ECG',
    brand: 'Defibtech',
    available: true,
    hint: 'Like the VIEW, with “Lifeline ECG” on the front; can show a heart trace',
    readinessSeconds: 10,
  },
];

/** Seconds to film the readiness indicator for; ten for an unknown unit. */
export function readinessSeconds(id?: string): number {
  return AED_MODEL_OPTIONS.find((m) => m.id === id)?.readinessSeconds ?? 10;
}

/** Brands offered to someone whose unit isn't one of the cards — the ones
 *  most often installed alongside Philips and ZOLL. "Other" catches the rest. */
export const OTHER_AED_BRANDS = [
  'Mindray',
  'Schiller',
  'HeartSine',
  'Physio-Control',
  'Cardiac Science',
  'Nihon Kohden',
  'Defibtech',
  'Other',
];

/** "Philips FRx" is the stored id; "Philips HeartStart FRx" is what is
 *  printed on the unit, so it's what the person holding it should read.
 *  A Powerheart reads as "ZOLL Powerheart G5": its name says the rest. */
export function modelDisplayName(id?: string): string {
  const { brand, name } = modelNameParts(id);
  return brand ? `${brand} ${name}` : name;
}

/** The display name in its two parts, for a bar that can only fit the
 *  model: "Defibtech" + "Lifeline VIEW". An unknown id is all name. */
export function modelNameParts(id?: string): { brand?: string; name: string } {
  const model = AED_MODEL_OPTIONS.find((m) => m.id === id);
  return model ? { brand: model.brand.split(' · ')[0], name: model.name } : { name: id ?? 'AED' };
}
