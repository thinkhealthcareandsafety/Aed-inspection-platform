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
    description: 'Photograph the label on the back of the AED so the serial number is sharp.',
    required: true,
    mediaType: 'image',
    icon: 'tag',
  },
  {
    id: 'pads_expiry',
    section: 1,
    order: 2,
    title: 'Pads expiry',
    description: 'Photograph the expiry date printed on the pads package.',
    required: true,
    mediaType: 'image',
    icon: 'bolt',
  },
  {
    id: 'battery_expiry',
    section: 1,
    order: 3,
    title: 'Battery expiry',
    description: 'Photograph the expiry date on the battery label. If the lot and serial number are in the shot, those are read too.',
    required: true,
    mediaType: 'image',
    icon: 'battery',
  },
  {
    id: 'battery_attached',
    section: 2,
    order: 4,
    title: 'Battery attached',
    description: 'Photograph the battery in place, showing it is pushed fully home.',
    required: true,
    mediaType: 'image',
    icon: 'plug',
  },
  {
    id: 'pads_connected',
    section: 2,
    order: 5,
    title: 'Pads connected',
    description: 'Photograph the pads connector plugged into the AED.',
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
      'Film the small status light (not the big green button) for at least 10 seconds. It can blink as rarely as every 5 seconds, so hold steady.',
    required: true,
    mediaType: 'video',
    icon: 'pulse-dot',
  },
  {
    id: 'child_key_pad',
    section: 3,
    order: 7,
    title: 'Child key / child pads',
    description: 'Photograph the child key or child pads, if this AED has them.',
    required: false,
    mediaType: 'image',
    icon: 'key',
  },
  {
    id: 'aed_cabinet',
    section: 3,
    order: 8,
    title: 'AED cabinet',
    description: 'Photograph the cabinet or case the AED is kept in.',
    required: false,
    mediaType: 'image',
    icon: 'archive',
  },
  {
    id: 'first_response_kit',
    section: 3,
    order: 9,
    title: 'Fast response kit',
    description: 'Photograph the rescue kit: gloves, razor, scissors and mask.',
    required: false,
    mediaType: 'image',
    icon: 'kit',
  },
  {
    id: 'emergency_contacts',
    section: 3,
    order: 10,
    title: 'Emergency contacts sticker',
    description: 'Photograph the emergency contact sticker on the AED or its cabinet.',
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
