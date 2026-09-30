import { toExpiryDate, daysUntil, urgencyOf, formatExpiryLabel, describeExpiry } from './expiry';

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

describe('formatExpiryLabel', () => {
  it('reads a month-only expiry the way the app shows it', () => {
    expect(formatExpiryLabel('2026-11')).toBe('Nov 2026');
  });

  it('keeps the day when there is one', () => {
    expect(formatExpiryLabel('2028-12-31')).toBe('31 Dec 2028');
  });

  it('leaves anything else alone', () => {
    expect(formatExpiryLabel('unreadable')).toBe('unreadable');
  });
});

describe('describeExpiry', () => {
  it('counts days close in, then months, then years', () => {
    expect(describeExpiry(1)).toBe('1 day left');
    expect(describeExpiry(30)).toBe('30 days left');
    expect(describeExpiry(63)).toBe('2 months left');
    expect(describeExpiry(900)).toBe('2+ years left');
  });

  it('says how long ago a lapsed date expired', () => {
    expect(describeExpiry(0)).toBe('Expires today');
    expect(describeExpiry(-1)).toBe('Expired yesterday');
    expect(describeExpiry(-100)).toBe('Expired 3 months ago');
  });
});
