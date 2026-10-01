export interface AedModelOption {
  id: string;
  name: string;
  brand: string;
  available: boolean;
  /** How to tell this unit apart while standing in front of it. Physical,
   *  checkable facts only — the model name is also printed on the device. */
  hint: string;
}

// Keep in sync with backend/src/config/aed-models.ts
export const AED_MODEL_OPTIONS: AedModelOption[] = [
  {
    id: 'Philips FRx',
    name: 'HeartStart FRx',
    brand: 'Philips',
    available: true,
    hint: 'Blue-grey, often kept in a red carry case',
  },
  {
    id: 'Philips HS1',
    name: 'HeartStart HS1',
    brand: 'Philips',
    available: true,
    hint: 'Deeper blue and upright, with a carry strap',
  },
  {
    id: 'Zoll AED Plus',
    name: 'AED Plus',
    // As ZOLL writes it on the unit and in its manuals.
    brand: 'ZOLL',
    available: true,
    hint: 'Bright green, handle moulded into the top',
  },
];

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
 *  printed on the unit, so it's what the person holding it should read. */
export function modelDisplayName(id?: string): string {
  const model = AED_MODEL_OPTIONS.find((m) => m.id === id);
  return model ? `${model.brand} ${model.name}` : (id ?? 'AED');
}
