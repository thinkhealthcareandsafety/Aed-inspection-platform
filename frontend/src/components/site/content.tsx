import Link from 'next/link';
import { ArrowRight, ChevronDown, Clock, FileCheck2, Gift } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CONTENT_UPDATED } from '@/lib/seo/site';

/** Structured data for search engines. `<` is escaped so no string in it can
 *  close the script tag early. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}

export function Breadcrumbs({ trail }: { trail: { name: string; path: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="no-print mb-5">
      <ol className="flex flex-wrap items-center gap-1.5 text-footnote text-muted-foreground">
        {trail.map((t, i) => (
          <li key={t.path} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-muted-foreground/50">/</span>}
            {i < trail.length - 1 ? (
              <Link href={t.path} className="transition-colors hover:text-foreground">
                {t.name}
              </Link>
            ) : (
              <span aria-current="page" className="text-foreground/80">
                {t.name}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

const UPDATED_LABEL = new Date(`${CONTENT_UPDATED}T00:00:00Z`).toLocaleDateString('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** Who wrote it and when: what a reader of safety advice should be told. */
export function Byline() {
  return (
    <p className="text-footnote text-muted-foreground">
      By the Think Health team, AED suppliers · Updated <time dateTime={CONTENT_UPDATED}>{UPDATED_LABEL}</time>
    </p>
  );
}

/**
 * The step from reading to doing: the free inspection, for this model when
 * the page is about one (the link carries it, so the model list is skipped).
 */
export function InspectCta({
  href = '/',
  title = 'Check your AED in 3 minutes, free',
  className,
  buttonLabel = 'Start free inspection',
}: {
  href?: string;
  title?: string;
  className?: string;
  buttonLabel?: string;
}) {
  const facts = [
    { Icon: Gift, label: 'Free' },
    { Icon: Clock, label: '3 minutes' },
    { Icon: FileCheck2, label: 'PDF report' },
  ];
  return (
    <aside className={cn('no-print surface-card px-5 py-5 sm:px-6', className)}>
      <p className="text-headline text-foreground">{title}</p>
      <p className="mt-1 text-callout text-muted-foreground">
        Your phone’s camera walks you through each check. AI reads every label and date, then emails you a
        report with what to fix.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Link
          href={href}
          className="pressable inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-5 text-headline text-primary-foreground transition-colors hover:bg-primary/92"
        >
          {buttonLabel}
          <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
        </Link>
        <ul className="flex gap-3 text-footnote text-muted-foreground">
          {facts.map(({ Icon, label }) => (
            <li key={label} className="inline-flex items-center gap-1">
              <Icon className="h-3.5 w-3.5" strokeWidth={1.9} />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
}

/** Questions as native disclosure rows: no script, and the answers are in
 *  the page for search engines whether open or not. */
export function FaqList({ faqs, className }: { faqs: { q: string; a: string }[]; className?: string }) {
  return (
    <div className={cn('surface-group', className)}>
      {faqs.map((f) => (
        <details key={f.q} className="surface-row group px-4">
          <summary className="flex cursor-pointer list-none items-start gap-3 py-3.5 text-body font-medium text-foreground [&::-webkit-details-marker]:hidden">
            <h3 className="flex-1">{f.q}</h3>
            <ChevronDown
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
              strokeWidth={2}
            />
          </summary>
          <p className="-mt-1 pb-4 text-callout text-muted-foreground">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
