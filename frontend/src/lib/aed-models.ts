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
    hint: 'Blue-grey, wider than it is tall',
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
    brand: 'Zoll',
    available: true,
    hint: 'Bright green, handle moulded into the top',
  },
];

export const COMING_SOON_MODELS = ['Cardiac Science', 'Defibtech', 'HeartSine', 'Physio-Control'];
