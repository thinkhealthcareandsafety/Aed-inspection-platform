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
