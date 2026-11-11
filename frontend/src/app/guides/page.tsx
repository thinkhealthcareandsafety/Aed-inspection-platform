import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { SitePage } from '@/components/site/SiteChrome';
import { Breadcrumbs, InspectCta, JsonLd } from '@/components/site/content';
import { GUIDES } from '@/lib/seo/guides';
import { absoluteUrl, breadcrumbLd, ldGraph, pageMetadata } from '@/lib/seo/site';

const TITLE = 'AED Guides: Inspection, Pads, Batteries and Status Lights';
const DESCRIPTION =
  'Plain-English AED guides: the monthly inspection checklist, what the status light means, pads and battery expiry, and how to tell how old an AED is.';

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: '/guides' });

export default function GuidesPage() {
  const trail = [
    { name: 'Home', path: '/' },
    { name: 'Guides', path: '/guides' },
  ];
  return (
    <SitePage>
      <JsonLd
        data={ldGraph(
          {
            '@type': 'CollectionPage',
            name: TITLE,
            description: DESCRIPTION,
            url: absoluteUrl('/guides'),
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: GUIDES.map((g, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: g.heading,
                url: absoluteUrl(`/guides/${g.slug}`),
              })),
            },
          },
          breadcrumbLd(trail),
        )}
      />
      <Breadcrumbs trail={trail} />
      <h1 className="text-display text-foreground sm:text-display-lg">AED guides</h1>
      <p className="mt-3 max-w-xl text-body text-muted-foreground">
        What to check on an AED, how often, and what the lights and labels mean. Written for the person responsible
        for the AED at a school, office, gym or housing society, not for engineers.
      </p>

      <ul className="surface-group mt-7">
        {GUIDES.map((g) => (
          <li key={g.slug} className="surface-row">
            <Link href={`/guides/${g.slug}`} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/50">
              <span className="min-w-0 flex-1">
                <span className="block text-headline text-foreground">{g.heading}</span>
                <span className="mt-0.5 block text-callout text-muted-foreground">{g.blurb}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-callout text-muted-foreground">
        Looking for one model? See the{' '}
        <Link href="/aed" className="font-medium text-primary hover:underline">
          inspection guide for your AED
        </Link>
        .
      </p>

      <InspectCta className="mt-10" />
    </SitePage>
  );
}
