/**
 * How old an AED is, from what its serial label says — and what that means
 * for its warranty under Think Health's 5-year replacement cycle.
 *
 * Where the year comes from, per maker (checked against real units):
 * - Philips FRx / HS1: a letter, the 2-digit year, a month letter A-L —
 *   HS1 "A18A-06336" is January 2018, FRx "B17C-00516" March 2017.
 * - ZOLL AED Plus: "X", the 2-digit year, a month letter — "X14K718292" is
 *   November 2014. The AED 3 follows ZOLL's rule after its "A" — "AX19D…".
 * - Powerheart G3 / G5: the serial carries no date; the manufacture date is
 *   printed beside the factory symbol on the same label, and is read there.
 * - Defibtech Lifeline / AUTO / VIEW / ECG: a 9-digit serial with no date in
 *   it, so the age comes from the label's date of manufacture, if shown.
 *
 * Anything that doesn't match its model's pattern exactly gives no age at
 * all: telling someone their AED is ten years old when it isn't would be
 * worse than saying nothing. Keep in sync with backend/src/utils/device-age.ts.
 */
export type AgeBand = 'current' | 'checkInvoice' | 'replace' | 'replaceUrgently';

export interface DeviceAge {
  year: number;
  /** Whole years since the year of manufacture. */
  age: number;
  band: AgeBand;
  /** Where the year came from: the serial number, or a date on the label. */
  source: 'serial' | 'label';
}

const SERIAL_YEAR: Record<string, RegExp> = {
  'Philips FRx': /^[A-Z](\d{2})[A-L]/,
  'Philips HS1': /^[A-Z](\d{2})[A-L]/,
  'Zoll AED Plus': /^X(\d{2})[A-L]/,
  'Zoll AED 3': /^AX(\d{2})[A-L]/,
};

/** Warranty runs 5 years: inside it, in its last year, past it, past an
 *  AED's usual 10-year life. */
function bandOf(age: number): AgeBand {
  if (age <= 4) return 'current';
  if (age === 5) return 'checkInvoice';
  if (age <= 10) return 'replace';
  return 'replaceUrgently';
}

export function deviceAge(
  aedModel: string | undefined,
  serial: string | null | undefined,
  labelDate: string | null | undefined,
  today: Date = new Date(),
): DeviceAge | null {
  const thisYear = today.getFullYear();
  const plausible = (y: number) => y >= 1995 && y <= thisYear;
  const make = (year: number, source: DeviceAge['source']): DeviceAge => {
    const age = thisYear - year;
    return { year, age, band: bandOf(age), source };
  };

  const pattern = aedModel ? SERIAL_YEAR[aedModel] : undefined;
  const cleaned = (serial ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = pattern && cleaned ? cleaned.match(pattern) : null;
  if (match) {
    const year = 2000 + Number(match[1]);
    if (plausible(year)) return make(year, 'serial');
  }

  const labelYear = labelDate ? Number(String(labelDate).slice(0, 4)) : NaN;
  if (Number.isInteger(labelYear) && plausible(labelYear)) return make(labelYear, 'label');
  return null;
}
