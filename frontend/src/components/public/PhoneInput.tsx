'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  COUNTRIES,
  flagEmoji,
  isValidNationalNumber,
  parsePhoneValue,
  type Country,
} from '@/lib/countries';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Form-level error (e.g. "required") to show instead of the local real-time hint. */
  error?: string;
  disabled?: boolean;
}

export function PhoneInput({ value, onChange, onBlur, error, disabled }: Props) {
  const initial = useRef(parsePhoneValue(value)).current;
  const [country, setCountry] = useState<Country>(initial.country);
  const [digits, setDigits] = useState(initial.nationalDigits);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    function onEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEscape);
    };
  }, []);

  useEffect(() => {
    if (open) searchRef.current?.focus();
  }, [open]);

  const filtered = COUNTRIES.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.dialCode.includes(search.replace('+', '')),
  );

  const valid = isValidNationalNumber(country, digits);
  const touchedInvalid = digits.length > 0 && !valid;
  const lengthHint =
    country.minLength === country.maxLength
      ? `${country.minLength} digits`
      : `${country.minLength}-${country.maxLength} digits`;

  function selectCountry(c: Country) {
    setCountry(c);
    setDigits('');
    setOpen(false);
    setSearch('');
    onChange(`+${c.dialCode}`);
  }

  function handleDigitsChange(raw: string) {
    const cleaned = raw.replace(/\D/g, '').slice(0, country.maxLength);
    setDigits(cleaned);
    onChange(`+${country.dialCode}${cleaned}`);
  }

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 shrink-0 -ml-0.5 px-1 py-0.5 rounded-md text-body hover:bg-secondary transition-colors disabled:opacity-60"
          aria-label="Select country"
        >
          <span className="text-[15px] leading-none">{flagEmoji(country.iso2)}</span>
          <span className="font-mono text-callout text-muted-foreground">+{country.dialCode}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground/70" strokeWidth={2} />
        </button>

        <span className="w-px h-4 bg-border shrink-0" aria-hidden />

        <input
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          disabled={disabled}
          value={digits}
          onChange={(e) => handleDigitsChange(e.target.value)}
          onBlur={onBlur}
          placeholder={country.example ?? '0'.repeat(country.minLength)}
          className="flex-1 min-w-0 bg-transparent text-body text-foreground placeholder:text-muted-foreground/45 focus:outline-none disabled:opacity-60"
        />
      </div>

      {error ? (
        <p className="text-footnote text-destructive mt-1">{error}</p>
      ) : touchedInvalid ? (
        <p className="text-footnote text-destructive mt-1">
          {country.name} numbers need {lengthHint} ({digits.length} so far)
        </p>
      ) : null}

      {open && (
        <div className="absolute z-50 mt-1.5 w-full min-w-[260px] rounded-xl border border-border bg-card shadow-lg overflow-hidden">
          <div className="p-2 border-b border-border/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                ref={searchRef}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search country or code…"
                className="w-full pl-8 pr-2.5 py-1.5 text-xs rounded-lg bg-secondary border border-border/50 focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 && (
              <p className="px-3 py-3 text-xs text-muted-foreground text-center">No matches</p>
            )}
            {filtered.map((c) => (
              <button
                key={c.iso2}
                type="button"
                onClick={() => selectCountry(c)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-secondary/60 transition-colors',
                  c.iso2 === country.iso2 && 'bg-primary/5',
                )}
              >
                <span className="text-base leading-none shrink-0">{flagEmoji(c.iso2)}</span>
                <span className="flex-1 min-w-0 truncate">{c.name}</span>
                <span className="font-mono text-xs text-muted-foreground shrink-0">+{c.dialCode}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
