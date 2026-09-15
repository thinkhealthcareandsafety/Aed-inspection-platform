/**
 * AED models selectable from the public (unauthenticated) inspection wizard.
 * Keep in sync with frontend/src/lib/aed-models.ts.
 */
export const PUBLIC_AED_MODELS = ['Philips FRx', 'Philips HS1', 'Zoll AED Plus'] as const;

export type PublicAedModel = (typeof PUBLIC_AED_MODELS)[number];

export function isPublicAedModel(value: string): value is PublicAedModel {
  return (PUBLIC_AED_MODELS as readonly string[]).includes(value);
}
