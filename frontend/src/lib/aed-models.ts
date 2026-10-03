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
   *  about five seconds after its lid is touched, so it gets ten too. */
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
  const model = AED_MODEL_OPTIONS.find((m) => m.id === id);
  return model ? `${model.brand.split(' · ')[0]} ${model.name}` : (id ?? 'AED');
}
