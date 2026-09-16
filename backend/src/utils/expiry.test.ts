import { toExpiryDate, daysUntil, urgencyOf } from './expiry';

describe('toExpiryDate', () => {
  it('reads a month-only label as the END of that month', () => {
    // A consumable stamped 2027-03 is usable through 31 March. Treating it as
    // 1 March would tell a customer their pads died four weeks early.
    const d = toExpiryDate('2027-03');
    expect(d?.toISOString()).toBe('2027-03-31T23:59:59.000Z');
  });

  it('handles February in a leap year', () => {
    expect(toExpiryDate('2028-02')?.toISOString()).toBe('2028-02-29T23:59:59.000Z');
  });

  it('handles February in a common year', () => {
    expect(toExpiryDate('2027-02')?.toISOString()).toBe('2027-02-28T23:59:59.000Z');
  });

  it('keeps an exact day when the label carries one', () => {
    expect(toExpiryDate('2027-03-14')?.toISOString()).toBe('2027-03-14T23:59:59.000Z');
  });

  it('crosses a year boundary correctly', () => {
    expect(toExpiryDate('2026-12')?.toISOString()).toBe('2026-12-31T23:59:59.000Z');
  });

  it('returns undefined for anything it cannot parse', () => {
    for (const bad of ['', '  ', 'MAR 2027', '03/2027', '2027', 'not a date', null, undefined]) {
      expect(toExpiryDate(bad as string | null | undefined)).toBeUndefined();
    }
  });
});

describe('daysUntil', () => {
  const now = new Date('2026-09-16T10:00:00.000Z');

  it('counts forward to a future expiry', () => {
    expect(daysUntil(new Date('2026-09-30T23:59:59.000Z'), now)).toBe(15);
  });

  it('goes negative once the date has passed', () => {
    expect(daysUntil(new Date('2026-08-31T23:59:59.000Z'), now)).toBeLessThan(0);
  });
});

describe('urgencyOf', () => {
  it('buckets on the boundaries the sales process actually uses', () => {
    expect(urgencyOf(-1)).toBe('expired');
    expect(urgencyOf(0)).toBe('critical');
    expect(urgencyOf(30)).toBe('critical');
    expect(urgencyOf(31)).toBe('soon');
    expect(urgencyOf(90)).toBe('soon');
    expect(urgencyOf(91)).toBe('ok');
  });
});
