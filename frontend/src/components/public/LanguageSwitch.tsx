'use client';

import { Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { track } from '@/lib/track';

/** Names the other language in that language — "हिन्दी" on the English
 *  screens, "English" on the Hindi ones — so someone who can't read the
 *  current screen can still find the way out of it. */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang, m } = useI18n();
  const next = lang === 'en' ? 'hi' : 'en';

  return (
    <button
      type="button"
      onClick={() => {
        setLang(next);
        track('language_changed', { outcome: next });
      }}
      aria-label={m.switchTo}
      className={cn(
        'pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-callout font-medium',
        'text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground',
        className,
      )}
    >
      <Languages className="h-4 w-4" strokeWidth={1.9} aria-hidden />
      <span lang={next}>{next === 'hi' ? 'हिन्दी' : 'English'}</span>
    </button>
  );
}
