/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';
import { SitePage } from '@/components/site/SiteChrome';
import { Breadcrumbs, InspectCta, JsonLd } from '@/components/site/content';
import { MODEL_GUIDES, OTHER_BRANDS_LINE } from '@/lib/seo/models';
import { DEVICE_PHOTO } from '@/lib/device-photos';
import { absoluteUrl, breadcrumbLd, ldGraph, pageMetadata } from '@/lib/seo/site';

const TITLE = 'AED Inspection Guides by Model: Philips, ZOLL, Powerheart';
const DESCRIPTION =
  'Step-by-step inspection guides for Philips HeartStart FRx and HS1, ZOLL AED Plus and AED 3, Powerheart G3 and G5, and Defibtech Lifeline AEDs.';

export const metadata: Metadata = pageMetadata({ title: TITLE, description: DESCRIPTION, path: '/aed' });

export default function ModelsPage() {
  const trail = [
    { name: 'Home', path: '/' },
    { name: 'AED models', path: '/aed' },
  ];
  return (
    <SitePage>
      <JsonLd
        data={ldGraph(
          {
            '@type': 'CollectionPage',
            name: TITLE,
            description: DESCRIPTION,
            url: absoluteUrl('/aed'),
            mainEntity: {
              '@type': 'ItemList',
              itemListElement: MODEL_GUIDES.map((g, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: `How to inspect a ${g.fullName}`,
                url: absoluteUrl(`/aed/${g.slug}`),
              })),
            },
          },
          breadcrumbLd(trail),
        )}
      />
      <Breadcrumbs trail={trail} />
      <h1 className="text-display text-foreground sm:text-display-lg">AED inspection guides by model</h1>
      <p className="mt-3 max-w-xl text-body text-muted-foreground">
        Where the readiness light is, what it should show, and where every date is printed, for the AED in front of
        you. Pick yours: each guide links straight to a free inspection of that exact model.
      </p>

      <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
        {MODEL_GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/aed/${g.slug}`} className="surface-tile pressable flex items-center gap-4 p-3 pr-4">
              <img
                src={DEVICE_PHOTO[g.id]?.tile ?? g.photo}
                width={72}
                height={72}
                alt=""
                className="h-[72px] w-[72px] shrink-0 rounded-xl bg-white object-contain p-1"
              />
              <span className="min-w-0">
                <span className="block text-headline text-foreground">{g.fullName.replace('Cardiac Science ', '')}</span>
                <span className="mt-0.5 block text-footnote text-muted-foreground">{g.identify.split('. ')[0]}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <section className="guide mt-4">
        <h2>Don’t see your AED?</h2>
        <p>
          The app also helps owners of {OTHER_BRANDS_LINE}. Start an inspection and choose “My AED isn’t listed”: tell us
          which one you have and our team will help you inspect it.
        </p>
        <p>
          New to this? Start with the <Link href="/guides/aed-inspection-checklist">AED inspection checklist</Link>, which
          works for any model.
        </p>
      </section>

      <InspectCta className="mt-10" />
    </SitePage>
  );
}
