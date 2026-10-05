/**
 * How old an AED is, from its serial label, against Think Health's 5-year
 * replacement cycle. Mirrors frontend/src/lib/device-age.ts — see there for
 * where each maker puts the year. A serial that doesn't match its model's
 * pattern gives no age at all, never a guess.
 */
export type AgeBand = 'current' | 'checkInvoice' | 'replace' | 'replaceUrgently';

export interface DeviceAge {
  year: number;
  age: number;
  band: AgeBand;
}

const SERIAL_YEAR: Record<string, RegExp> = {
  'Philips FRx': /^[A-Z](\d{2})[A-L]/,
  'Philips HS1': /^[A-Z](\d{2})[A-L]/,
  'Zoll AED Plus': /^X(\d{2})[A-L]/,
  'Zoll AED 3': /^AX(\d{2})[A-L]/,
};

function bandOf(age: number): AgeBand {
  if (age <= 4) return 'current';
  if (age === 5) return 'checkInvoice';
  if (age <= 10) return 'replace';
  return 'replaceUrgently';
}

export function deviceAge(
  aedModel: unknown,
  serial: unknown,
  labelDate: unknown,
  today: Date = new Date(),
): DeviceAge | null {
  const thisYear = today.getFullYear();
  const plausible = (y: number) => y >= 1995 && y <= thisYear;
  const make = (year: number): DeviceAge => ({ year, age: thisYear - year, band: bandOf(thisYear - year) });

  const pattern = typeof aedModel === 'string' ? SERIAL_YEAR[aedModel] : undefined;
  const cleaned = String(serial ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const match = pattern && cleaned ? cleaned.match(pattern) : null;
  if (match && plausible(2000 + Number(match[1]))) return make(2000 + Number(match[1]));

  const labelYear = labelDate ? Number(String(labelDate).slice(0, 4)) : NaN;
  if (Number.isInteger(labelYear) && plausible(labelYear)) return make(labelYear);
  return null;
}
