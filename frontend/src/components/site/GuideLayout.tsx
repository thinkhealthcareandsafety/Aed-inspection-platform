import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { SitePage } from './SiteChrome';
import { Breadcrumbs, Byline, FaqList, InspectCta, JsonLd } from './content';
import { GUIDES, guideEntry } from '@/lib/seo/guides';
import { articleLd, breadcrumbLd, faqLd, ldGraph, pageMetadata } from '@/lib/seo/site';

export function guideMetadata(slug: string): Metadata {
  const g = guideEntry(slug);
  return pageMetadata({ title: g.title, description: g.description, path: `/guides/${slug}`, type: 'article' });
}

/** A guide: its heading and summary, the content, its questions, and the
 *  way on to the free inspection and the other guides. */
export function GuideLayout({
  slug,
  intro,
  faqs,
  children,
}: {
  slug: string;
  intro: ReactNode;
  faqs: { q: string; a: string }[];
  children: ReactNode;
}) {
  const g = guideEntry(slug);
  const path = `/guides/${slug}`;
  const trail = [
    { name: 'Home', path: '/' },
    { name: 'Guides', path: '/guides' },
    { name: g.heading, path },
  ];
  const others = GUIDES.filter((o) => o.slug !== slug);

  return (
    <SitePage>
      <JsonLd
        data={ldGraph(
          articleLd({ title: g.heading, description: g.description, path }),
          breadcrumbLd(trail),
          ...(faqs.length ? [faqLd(faqs)] : []),
        )}
      />
      <Breadcrumbs trail={trail} />
      <h1 className="text-display text-foreground sm:text-display-lg">{g.heading}</h1>
      <div className="mt-3 text-body text-muted-foreground">{intro}</div>
      <div className="mt-3">
        <Byline />
      </div>

      <InspectCta className="mt-6" />

      <article className="guide mt-2">{children}</article>

      {faqs.length > 0 && (
        <section className="mt-12" aria-labelledby="faq">
          <h2 id="faq" className="mb-3 text-title text-foreground">
            Common questions
          </h2>
          <FaqList faqs={faqs} />
        </section>
      )}

      <InspectCta className="mt-10" title="Let the app do the checking" />

      <section className="no-print mt-12" aria-labelledby="more-guides">
        <h2 id="more-guides" className="mb-3 text-title text-foreground">
          More AED guides
        </h2>
        <ul className="surface-group">
          {others.map((o) => (
            <li key={o.slug} className="surface-row">
              <Link
                href={`/guides/${o.slug}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-foreground">{o.heading}</span>
                  <span className="block text-footnote text-muted-foreground">{o.blurb}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </SitePage>
  );
}
