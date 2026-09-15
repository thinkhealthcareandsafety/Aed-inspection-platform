/**
 * Country dial codes + national mobile-number length rules, for the phone
 * input's country selector and real-time validation. Not the full ITU list
 * (~200 territories) — the major markets, covering every region, with
 * accurate min/max national-number digit counts sourced per-country. Add
 * more entries here as needed; everything else (the input, the validator)
 * reads from this table, nothing is hardcoded elsewhere.
 */
export interface Country {
  name: string;
  iso2: string;
  dialCode: string; // digits only, no '+'
  minLength: number;
  maxLength: number;
  /** A realistic sample national number, used as the input's placeholder. */
  example?: string;
}

export const COUNTRIES: Country[] = [
  { name: 'India', iso2: 'IN', dialCode: '91', minLength: 10, maxLength: 10, example: '98765 43210' },
  { name: 'United States', iso2: 'US', dialCode: '1', minLength: 10, maxLength: 10, example: '555 123 4567' },
  { name: 'Canada', iso2: 'CA', dialCode: '1', minLength: 10, maxLength: 10, example: '555 123 4567' },
  { name: 'United Kingdom', iso2: 'GB', dialCode: '44', minLength: 10, maxLength: 11, example: '7911 123456' },
  { name: 'Ireland', iso2: 'IE', dialCode: '353', minLength: 9, maxLength: 9 },
  { name: 'Germany', iso2: 'DE', dialCode: '49', minLength: 10, maxLength: 11, example: '1512 3456789' },
  { name: 'France', iso2: 'FR', dialCode: '33', minLength: 9, maxLength: 9, example: '6 12 34 56 78' },
  { name: 'Spain', iso2: 'ES', dialCode: '34', minLength: 9, maxLength: 9 },
  { name: 'Italy', iso2: 'IT', dialCode: '39', minLength: 9, maxLength: 10 },
  { name: 'Netherlands', iso2: 'NL', dialCode: '31', minLength: 9, maxLength: 9 },
  { name: 'Belgium', iso2: 'BE', dialCode: '32', minLength: 8, maxLength: 9 },
  { name: 'Switzerland', iso2: 'CH', dialCode: '41', minLength: 9, maxLength: 9 },
  { name: 'Austria', iso2: 'AT', dialCode: '43', minLength: 10, maxLength: 11 },
  { name: 'Portugal', iso2: 'PT', dialCode: '351', minLength: 9, maxLength: 9 },
  { name: 'Sweden', iso2: 'SE', dialCode: '46', minLength: 7, maxLength: 9 },
  { name: 'Norway', iso2: 'NO', dialCode: '47', minLength: 8, maxLength: 8 },
  { name: 'Denmark', iso2: 'DK', dialCode: '45', minLength: 8, maxLength: 8 },
  { name: 'Finland', iso2: 'FI', dialCode: '358', minLength: 9, maxLength: 10 },
  { name: 'Poland', iso2: 'PL', dialCode: '48', minLength: 9, maxLength: 9 },
  { name: 'Greece', iso2: 'GR', dialCode: '30', minLength: 10, maxLength: 10 },
  { name: 'Turkey', iso2: 'TR', dialCode: '90', minLength: 10, maxLength: 10 },
  { name: 'Russia', iso2: 'RU', dialCode: '7', minLength: 10, maxLength: 10 },
  { name: 'Ukraine', iso2: 'UA', dialCode: '380', minLength: 9, maxLength: 9 },
  { name: 'China', iso2: 'CN', dialCode: '86', minLength: 11, maxLength: 11, example: '138 0013 8000' },
  { name: 'Japan', iso2: 'JP', dialCode: '81', minLength: 10, maxLength: 10 },
  { name: 'South Korea', iso2: 'KR', dialCode: '82', minLength: 9, maxLength: 10 },
  { name: 'Singapore', iso2: 'SG', dialCode: '65', minLength: 8, maxLength: 8, example: '9123 4567' },
  { name: 'Malaysia', iso2: 'MY', dialCode: '60', minLength: 9, maxLength: 10 },
  { name: 'Indonesia', iso2: 'ID', dialCode: '62', minLength: 9, maxLength: 12 },
  { name: 'Philippines', iso2: 'PH', dialCode: '63', minLength: 10, maxLength: 10 },
  { name: 'Thailand', iso2: 'TH', dialCode: '66', minLength: 9, maxLength: 9 },
  { name: 'Vietnam', iso2: 'VN', dialCode: '84', minLength: 9, maxLength: 10 },
  { name: 'Pakistan', iso2: 'PK', dialCode: '92', minLength: 10, maxLength: 10 },
  { name: 'Bangladesh', iso2: 'BD', dialCode: '880', minLength: 10, maxLength: 10 },
  { name: 'United Arab Emirates', iso2: 'AE', dialCode: '971', minLength: 9, maxLength: 9, example: '50 123 4567' },
  { name: 'Saudi Arabia', iso2: 'SA', dialCode: '966', minLength: 9, maxLength: 9 },
  { name: 'Israel', iso2: 'IL', dialCode: '972', minLength: 9, maxLength: 9 },
  { name: 'Qatar', iso2: 'QA', dialCode: '974', minLength: 8, maxLength: 8 },
  { name: 'Kuwait', iso2: 'KW', dialCode: '965', minLength: 8, maxLength: 8 },
  { name: 'South Africa', iso2: 'ZA', dialCode: '27', minLength: 9, maxLength: 9 },
  { name: 'Nigeria', iso2: 'NG', dialCode: '234', minLength: 10, maxLength: 10 },
  { name: 'Kenya', iso2: 'KE', dialCode: '254', minLength: 9, maxLength: 9 },
  { name: 'Egypt', iso2: 'EG', dialCode: '20', minLength: 10, maxLength: 10 },
  { name: 'Australia', iso2: 'AU', dialCode: '61', minLength: 9, maxLength: 9, example: '412 345 678' },
  { name: 'New Zealand', iso2: 'NZ', dialCode: '64', minLength: 8, maxLength: 9 },
  { name: 'Brazil', iso2: 'BR', dialCode: '55', minLength: 10, maxLength: 11 },
  { name: 'Argentina', iso2: 'AR', dialCode: '54', minLength: 10, maxLength: 11 },
  { name: 'Chile', iso2: 'CL', dialCode: '56', minLength: 9, maxLength: 9 },
  { name: 'Colombia', iso2: 'CO', dialCode: '57', minLength: 10, maxLength: 10 },
  { name: 'Peru', iso2: 'PE', dialCode: '51', minLength: 9, maxLength: 9 },
  { name: 'Mexico', iso2: 'MX', dialCode: '52', minLength: 10, maxLength: 10 },
];

export const DEFAULT_COUNTRY_ISO2 = 'IN';

export function findCountry(iso2: string): Country {
  return COUNTRIES.find((c) => c.iso2 === iso2) ?? COUNTRIES[0];
}

/** Regional-indicator flag emoji from an ISO 3166-1 alpha-2 code — no image assets needed. */
export function flagEmoji(iso2: string): string {
  return iso2
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

/** True if `nationalDigits` (digits only, no dial code) is a valid length for `country`. */
export function isValidNationalNumber(country: Country, nationalDigits: string): boolean {
  return (
    /^\d+$/.test(nationalDigits) &&
    nationalDigits.length >= country.minLength &&
    nationalDigits.length <= country.maxLength
  );
}

/** Parses a stored "+<dialCode><digits>" value back into {country, nationalDigits}. */
export function parsePhoneValue(value: string | undefined): { country: Country; nationalDigits: string } {
  const fallback = findCountry(DEFAULT_COUNTRY_ISO2);
  if (!value?.startsWith('+')) return { country: fallback, nationalDigits: '' };

  const digits = value.slice(1);
  // Longest matching dial code wins (e.g. '1' vs no 3-digit code starting with 1 here,
  // but this keeps the lookup correct as codes are added).
  const match = [...COUNTRIES]
    .sort((a, b) => b.dialCode.length - a.dialCode.length)
    .find((c) => digits.startsWith(c.dialCode));

  if (!match) return { country: fallback, nationalDigits: '' };
  return { country: match, nationalDigits: digits.slice(match.dialCode.length) };
}
