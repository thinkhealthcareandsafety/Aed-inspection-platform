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
  // Product shots from ZOLL's retailers (aedbrands.com, buyaedindia.com),
  // cut out and framed like the three above.
  'Zoll AED 3': { tile: '/devices/zoll-aed3.webp', large: '/devices/zoll-aed3-lg.webp' },
  'Zoll Powerheart G3': { tile: '/devices/powerheart-g3.webp', large: '/devices/powerheart-g3-lg.webp' },
  'Zoll Powerheart G5': { tile: '/devices/powerheart-g5.webp', large: '/devices/powerheart-g5-lg.webp' },
  // Defibtech's own product shots, via its dealers (aed.us, medshop.com.au).
  'Defibtech Lifeline': { tile: '/devices/defibtech-lifeline.webp', large: '/devices/defibtech-lifeline-lg.webp' },
  'Defibtech Lifeline AUTO': {
    tile: '/devices/defibtech-lifeline-auto.webp',
    large: '/devices/defibtech-lifeline-auto-lg.webp',
  },
  'Defibtech Lifeline VIEW': {
    tile: '/devices/defibtech-lifeline-view.webp',
    large: '/devices/defibtech-lifeline-view-lg.webp',
  },
  'Defibtech Lifeline ECG': {
    tile: '/devices/defibtech-lifeline-ecg.webp',
    large: '/devices/defibtech-lifeline-ecg-lg.webp',
  },
};
