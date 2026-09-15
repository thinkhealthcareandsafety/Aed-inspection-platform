import type { ChecklistItemId, ChecklistMediaType } from '@/types';
import type { IconName } from '@/components/icons';

export interface ChecklistItemMeta {
  id: ChecklistItemId;
  section: 1 | 2 | 3;
  order: number;
  title: string;
  description: string;
  required: boolean;
  mediaType: ChecklistMediaType;
  icon: IconName;
}

export const CHECKLIST_ITEMS: ChecklistItemMeta[] = [
  {
    id: 'serial_number',
    section: 1,
    order: 1,
    title: 'Serial number',
    description: 'Live photo of the manufacturer serial number label.',
    required: true,
    mediaType: 'image',
    icon: 'tag',
  },
  {
    id: 'pads_expiry',
    section: 1,
    order: 2,
    title: 'Pads expiry',
    description: 'Photo of the electrode pads expiry date.',
    required: true,
    mediaType: 'image',
    icon: 'bolt',
  },
  {
    id: 'battery_expiry',
    section: 1,
    order: 3,
    title: 'Battery expiry',
    description: 'Photo of the battery expiry date. Lot & serial number are read automatically if visible (optional).',
    required: true,
    mediaType: 'image',
    icon: 'battery',
  },
  {
    id: 'battery_attached',
    section: 2,
    order: 4,
    title: 'Battery attached',
    description: 'Photo confirming the battery is fully seated in the machine.',
    required: true,
    mediaType: 'image',
    icon: 'plug',
  },
  {
    id: 'pads_connected',
    section: 2,
    order: 5,
    title: 'Pads connected',
    description: 'Photo confirming the pads connector is plugged in.',
    required: true,
    mediaType: 'image',
    icon: 'plug',
  },
  {
    id: 'readiness_indicator',
    section: 2,
    order: 6,
    title: 'Readiness indicator',
    description:
      'Record at least 10 seconds of the small status LED (not the big green power button). Blinks can be up to 5 seconds apart, so hold steady long enough to catch one.',
    required: true,
    mediaType: 'video',
    icon: 'pulse-dot',
  },
  {
    id: 'child_key_pad',
    section: 3,
    order: 7,
    title: 'Child key / child pads',
    description: 'Photo of the paediatric key or child pads, if present.',
    required: false,
    mediaType: 'image',
    icon: 'key',
  },
  {
    id: 'aed_cabinet',
    section: 3,
    order: 8,
    title: 'AED cabinet',
    description: 'Photo of the wall cabinet/case housing the AED.',
    required: false,
    mediaType: 'image',
    icon: 'archive',
  },
  {
    id: 'first_response_kit',
    section: 3,
    order: 9,
    title: 'Fast response kit',
    description: 'Photo of the accompanying rescue kit (gloves, razor, scissors, mask).',
    required: false,
    mediaType: 'image',
    icon: 'kit',
  },
  {
    id: 'emergency_contacts',
    section: 3,
    order: 10,
    title: 'Emergency contacts sticker',
    description: 'Photo confirming an emergency contact sticker is on the machine or cabinet.',
    required: false,
    mediaType: 'image',
    icon: 'contact',
  },
];

export const CHECKLIST_SECTIONS = [
  {
    section: 1 as const,
    title: 'Consumables & Identification',
    subtitle: 'Serial number, pads, and battery expiry',
    items: CHECKLIST_ITEMS.filter((i) => i.section === 1),
  },
  {
    section: 2 as const,
    title: 'Physical Status',
    subtitle: 'Battery, pads, and readiness indicator',
    items: CHECKLIST_ITEMS.filter((i) => i.section === 2),
  },
  {
    section: 3 as const,
    title: 'Accessories & Signage',
    subtitle: 'All optional',
    items: CHECKLIST_ITEMS.filter((i) => i.section === 3),
  },
];

export const REQUIRED_ITEM_IDS = CHECKLIST_ITEMS.filter((i) => i.required).map((i) => i.id);

export function getChecklistItemMeta(id: string): ChecklistItemMeta | undefined {
  return CHECKLIST_ITEMS.find((i) => i.id === id);
}
