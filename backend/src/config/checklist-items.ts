/**
 * AED inspection checklist catalogue — 3 sections, 10 items.
 *
 * Mirrors python-cv/app/services/checklist_items.py (which owns the actual
 * Gemini prompt text). This copy only needs the metadata the backend uses
 * for validation and result derivation: id, section, required, media type.
 */

export type ChecklistMediaType = 'image' | 'video';

export interface ChecklistItemMeta {
  id: string;
  section: 1 | 2 | 3;
  order: number;
  title: string;
  required: boolean;
  mediaType: ChecklistMediaType;
}

export const CHECKLIST_ITEMS: ChecklistItemMeta[] = [
  { id: 'serial_number', section: 1, order: 1, title: 'Serial number', required: true, mediaType: 'image' },
  { id: 'pads_expiry', section: 1, order: 2, title: 'Pads expiry', required: true, mediaType: 'image' },
  { id: 'battery_expiry', section: 1, order: 3, title: 'Battery expiry', required: true, mediaType: 'image' },
  { id: 'battery_attached', section: 2, order: 4, title: 'Battery attached', required: true, mediaType: 'image' },
  { id: 'pads_connected', section: 2, order: 5, title: 'Pads connected', required: true, mediaType: 'image' },
  { id: 'readiness_indicator', section: 2, order: 6, title: 'Readiness indicator', required: true, mediaType: 'video' },
  { id: 'child_key_pad', section: 3, order: 7, title: 'Child key / child pads', required: false, mediaType: 'image' },
  { id: 'aed_cabinet', section: 3, order: 8, title: 'AED cabinet', required: false, mediaType: 'image' },
  { id: 'first_response_kit', section: 3, order: 9, title: 'Fast response kit', required: false, mediaType: 'image' },
  { id: 'emergency_contacts', section: 3, order: 10, title: 'Emergency contacts sticker', required: false, mediaType: 'image' },
];

export const CHECKLIST_ITEM_IDS = CHECKLIST_ITEMS.map((i) => i.id);

const _byId = new Map(CHECKLIST_ITEMS.map((i) => [i.id, i]));

export function getChecklistItem(id: string): ChecklistItemMeta | undefined {
  return _byId.get(id);
}

export const REQUIRED_ITEM_IDS = CHECKLIST_ITEMS.filter((i) => i.required).map((i) => i.id);
