'use client';

import { useI18n } from '@/i18n';

export function BrandFooter() {
  const { m } = useI18n();
  return (
    <footer className="px-5 py-5 text-center">
      <p className="text-[11.5px] text-muted-foreground/70">
        {m.common.poweredBy(
          <span className="font-semibold text-muted-foreground">Think Healthcare and Safety</span>,
        )}
        <span className="mx-1.5 text-muted-foreground/40">&middot;</span>
        <span className="font-mono">inspector.aedsmartx.com</span>
      </p>
    </footer>
  );
}
