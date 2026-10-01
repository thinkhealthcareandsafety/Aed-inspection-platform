/**
 * A photo of each unit, so the person matches the device in front of them
 * at a glance — the bright green one, the upright blue one. The studio shots
 * from buyaedindia.com, cut out and framed identically, so the three read as
 * one set and the tile fades into its large version without a jump.
 */
export const DEVICE_PHOTO: Record<string, { tile: string; large: string }> = {
  'Philips FRx': { tile: '/devices/frx.webp', large: '/devices/frx-lg.webp' },
  'Philips HS1': { tile: '/devices/hs1.webp', large: '/devices/hs1-lg.webp' },
  'Zoll AED Plus': { tile: '/devices/zoll.webp', large: '/devices/zoll-lg.webp' },
};
