import Link from 'next/link';
import type { ReactNode } from 'react';
import { BrandLockup } from '@/components/public/BrandLockup';
import { MODEL_GUIDES } from '@/lib/seo/models';
import { GUIDES } from '@/lib/seo/guides';

/**
 * The frame around the guide pages. Server-rendered and script-free: these
 * pages exist to be read (by people and by search engines) and to send the
 * reader to the free inspection, which is the one button in the bar.
 */
export function SiteHeader() {
  const link =
    'hidden sm:inline-flex h-9 items-center rounded-full px-3 text-callout font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground';
  return (
    <header className="no-print sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-3xl items-center gap-1.5 px-4 py-2.5">
        <Link href="/" aria-label="AED SmartX Inspector: start a free inspection" className="mr-auto min-w-0">
          <BrandLockup compact />
        </Link>
        <Link href="/aed" className={link}>
          AED models
        </Link>
        <Link href="/guides" className={link}>
          Guides
        </Link>
        <Link
          href="/"
          className="pressable ml-1.5 inline-flex h-9 shrink-0 items-center rounded-full bg-primary px-4 text-callout font-semibold text-primary-foreground transition-colors hover:bg-primary/92"
        >
          Free inspection
        </Link>
      </div>
    </header>
  );
}

export function SiteFooter() {
  const link = 'text-callout text-muted-foreground transition-colors hover:text-foreground';
  return (
    <footer className="no-print mt-20 border-t border-border/70">
      <div className="mx-auto grid max-w-3xl gap-8 px-4 py-10 sm:grid-cols-[1fr_1fr_1.1fr]">
        <nav aria-label="AED models">
          <p className="group-label !px-0">AED models</p>
          <ul className="space-y-1.5">
            {MODEL_GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={`/aed/${g.slug}`} className={link}>
                  {g.fullName.replace('Cardiac Science ', '')}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Guides">
          <p className="group-label !px-0">Guides</p>
          <ul className="space-y-1.5">
            {GUIDES.map((g) => (
              <li key={g.slug}>
                <Link href={`/guides/${g.slug}`} className={link}>
                  {g.heading}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="group-label !px-0">About</p>
          <p className="text-callout text-muted-foreground">
            AED SmartX Inspector is a free AED inspection app from Think Health, suppliers of AEDs, pads and
            batteries. Your phone’s camera does the checking; AI reads every label; you get a PDF report.
          </p>
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            <Link href="/" className={`${link} font-medium`}>
              Start a free inspection
            </Link>
            <a href="https://aedsmartx.com" className={link}>
              aedsmartx.com
            </a>
            <a href="https://thinkhealth.in" className={link}>
              thinkhealth.in
            </a>
          </p>
        </div>
      </div>
      <p className="mx-auto max-w-3xl px-4 pb-10 text-footnote text-muted-foreground/80">
        These guides cover routine visual checks. They don’t replace your AED maker’s instructions or a
        manufacturer’s service. In an emergency, call your local emergency number first.
      </p>
    </footer>
  );
}

/** One guide page: the bar, a readable column, the footer. */
export function SitePage({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 pt-6">{children}</main>
      <SiteFooter />
    </div>
  );
}
