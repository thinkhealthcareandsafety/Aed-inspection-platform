'use client';

import { useI18n } from '@/i18n';

/** Who is behind the app, and where to check: links open in a new tab so
 *  the inspection in this one is never lost. */
export function BrandFooter() {
  const { m } = useI18n();
  const link = 'tap-target font-medium text-muted-foreground hover:text-foreground transition-colors';
  return (
    <footer className="px-5 py-6 text-center text-[11.5px] leading-relaxed text-muted-foreground/70">
      <p>
        <span className="font-semibold text-muted-foreground">aedsmartx Inspector</span>
        <span className="mx-1.5 text-muted-foreground/40">&middot;</span>
        {m.common.productOf(<span className="font-semibold text-muted-foreground">Think Health™</span>)}
      </p>
      <p className="mt-0.5">
        <a href="https://thinkhealth.in" target="_blank" rel="noopener" className={link}>
          thinkhealth.in
        </a>
        <span className="mx-1.5 text-muted-foreground/40">&middot;</span>
        <a href="https://aedsmartx.com" target="_blank" rel="noopener" className={link}>
          aedsmartx.com
        </a>
      </p>
    </footer>
  );
}
