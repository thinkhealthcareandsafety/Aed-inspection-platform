/**
 * Standard-compliant email validation — the same pattern browsers use for
 * `<input type="email">` (the WHATWG HTML Living Standard's "valid email
 * address" regex), not Zod's looser built-in `.email()`. Rejects things
 * like consecutive/leading/trailing dots in the domain, missing TLD,
 * spaces, or a domain label starting/ending with a hyphen.
 */
export const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export const EMAIL_MAX_LENGTH = 254; // RFC 5321 §4.5.3.1.3

export function isValidEmail(value: string): boolean {
  return value.length > 0 && value.length <= EMAIL_MAX_LENGTH && EMAIL_REGEX.test(value);
}

/**
 * Mailbox providers people actually use here, spelled right. "gmial.com"
 * passes every syntax check and then silently eats the report — and the
 * lead with it — so a near miss on one of these gets a suggestion.
 */
const COMMON_DOMAINS = [
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.in',
  'ymail.com',
  'rediffmail.com',
  'outlook.com',
  'outlook.in',
  'hotmail.com',
  'live.com',
  'msn.com',
  'icloud.com',
  'me.com',
  'mail.com',
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'zohomail.in',
];

function editDistance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

/**
 * The corrected address when the domain is a likely typo of a common one
 * ("priya@gmial.com" → "priya@gmail.com"), otherwise null. Company domains
 * are left alone: only near misses — one or two keystrokes — of a known
 * provider are flagged, and never a domain that is itself on the list.
 */
export function suggestEmailFix(value: string): string | null {
  const email = value.trim();
  const at = email.lastIndexOf('@');
  if (at < 1 || at === email.length - 1) return null;
  const domain = email.slice(at + 1).toLowerCase();
  if (COMMON_DOMAINS.includes(domain)) return null;

  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of COMMON_DOMAINS) {
    const distance = editDistance(domain, candidate);
    if (distance < bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }
  // Two edits is the useful ceiling: "gmial.com", "gmail.co", "yaho.com".
  // Short domains need a tighter bound or "me.co" would become "me.com"-ish
  // guesses on real company addresses.
  const limit = domain.length <= 6 ? 1 : 2;
  return best && bestDistance > 0 && bestDistance <= limit ? `${email.slice(0, at + 1)}${best}` : null;
}
