export interface AedModelOption {
  id: string;
  name: string;
  brand: string;
  available: boolean;
}

// Keep in sync with backend/src/config/aed-models.ts
export const AED_MODEL_OPTIONS: AedModelOption[] = [
  { id: 'Philips FRx', name: 'HeartStart FRx', brand: 'Philips', available: true },
  { id: 'Philips HS1', name: 'HeartStart HS1', brand: 'Philips', available: true },
  { id: 'Zoll AED Plus', name: 'AED Plus', brand: 'Zoll', available: true },
];

export const COMING_SOON_MODELS = ['Cardiac Science', 'Defibtech', 'HeartSine', 'Physio-Control'];
