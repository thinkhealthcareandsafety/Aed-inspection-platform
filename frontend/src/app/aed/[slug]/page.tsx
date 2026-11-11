/* eslint-disable @next/next/no-img-element */
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SitePage } from '@/components/site/SiteChrome';
import { Breadcrumbs, Byline, FaqList, InspectCta, JsonLd } from '@/components/site/content';
import { MODEL_GUIDES, inspectHref, modelGuide } from '@/lib/seo/models';
import { DEVICE_PHOTO } from '@/lib/device-photos';
import { articleLd, breadcrumbLd, faqLd, ldGraph, pageMetadata } from '@/lib/seo/site';

export const dynamicParams = false;

export function generateStaticParams() {
  return MODEL_GUIDES.map((g) => ({ slug: g.slug }));
}

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const g = modelGuide((await params).slug);
  if (!g) return {};
  return pageMetadata({ title: g.title, description: g.description, path: `/aed/${g.slug}`, type: 'article' });
}

export default async function ModelGuidePage({ params }: { params: Params }) {
  const g = modelGuide((await params).slug);
  if (!g) notFound();

  const path = `/aed/${g.slug}`;
  const heading = `How to inspect a ${g.fullName}`;
  const trail = [
    { name: 'Home', path: '/' },
    { name: 'AED models', path: '/aed' },
    { name: g.fullName, path },
  ];
  const tile = DEVICE_PHOTO[g.id]?.tile;
  const others = MODEL_GUIDES.filter((o) => o.slug !== g.slug);
  const sameMaker = others.filter((o) => o.maker === g.maker);
  const related = [...sameMaker, ...others.filter((o) => o.maker !== g.maker)].slice(0, 4);
  const href = inspectHref(g.id);

  /** What a pass looks like, check by check, each linking to its section. */
  const steps = [
    { anchor: 'readiness', label: 'Readiness light', pass: g.readiness.ready.split('. ')[0].replace(/\.$/, '') },
    { anchor: 'serial', label: 'Serial number', pass: 'readable, and tells you how old the unit is' },
    { anchor: 'pads', label: 'Pads expiry', pass: 'the date has not passed' },
    { anchor: 'battery', label: 'Battery date', pass: 'the date has not passed' },
    { anchor: 'battery-fitted', label: 'Battery fitted', pass: 'pushed fully in and flush' },
    {
      anchor: 'pads-connected',
      label: 'Pads connected',
      pass: g.id === 'Philips HS1' ? 'the cartridge fitted, PULL handle down' : 'plugged into the AED',
    },
  ];

  return (
    <SitePage>
      <JsonLd
        data={ldGraph(
          articleLd({ title: heading, description: g.description, path, image: g.photo }),
          breadcrumbLd(trail),
          faqLd(g.faqs),
        )}
      />
      <Breadcrumbs trail={trail} />

      <div className="flex flex-col-reverse gap-5 sm:flex-row sm:items-center sm:gap-8">
        <div className="min-w-0 flex-1">
          <p className="text-caption uppercase text-muted-foreground" style={{ letterSpacing: '0.08em' }}>
            {g.maker} · inspection guide
          </p>
          <h1 className="mt-2 text-display text-foreground sm:text-display-lg">{heading}</h1>
          <p className="mt-3 text-body text-muted-foreground">
            The monthly check, step by step: the readiness light, the pads and battery dates, and the serial
            number that tells you how old it is. {g.aka ? `${g.aka}.` : ''}
          </p>
          <div className="mt-3">
            <Byline />
          </div>
        </div>
        <img
          src={g.photo}
          srcSet={tile ? `${tile} 320w, ${g.photo} 800w` : undefined}
          sizes="(min-width: 640px) 200px, 160px"
          width={200}
          height={200}
          alt={`${g.fullName} AED`}
          fetchPriority="high"
          className="h-40 w-40 shrink-0 rounded-3xl bg-white object-contain p-2 sm:h-[200px] sm:w-[200px]"
          style={{ boxShadow: '0 0 0 1px hsl(var(--border) / 0.9)' }}
        />
      </div>

      <section className="surface-group mt-7 px-5 py-4" aria-labelledby="quick-answer">
        <h2 id="quick-answer" className="text-headline text-foreground">
          The {g.shortName} check in six steps
        </h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-callout text-foreground/85 marker:text-muted-foreground">
          {steps.map((s) => (
            <li key={s.anchor}>
              <a href={`#${s.anchor}`} className="font-medium text-foreground hover:text-primary">
                {s.label}
              </a>
              : {s.pass.charAt(0).toLowerCase()}
              {s.pass.slice(1)}.
            </li>
          ))}
        </ol>
      </section>

      <InspectCta
        className="mt-5"
        href={href}
        title={`Check your ${g.shortName} in 3 minutes, free`}
        buttonLabel={`Inspect my ${g.shortName}`}
      />

      <article className="guide mt-4">
        <h2 id="identify">Is this your AED?</h2>
        <p>
          {g.identify} The model name is printed on the front of the unit and on the label at the back.
        </p>

        <h2 id="readiness">1. Is it ready? Check the readiness light</h2>
        <p>
          Every AED tests itself and shows the result on a readiness indicator. On the {g.shortName} it is{' '}
          <strong>{g.readiness.where}</strong>.
        </p>
        <ul>
          <li>
            <strong>Ready:</strong> {g.readiness.ready}
          </li>
          <li>
            <strong>Not ready:</strong> {g.readiness.notReady}
          </li>
        </ul>
        {g.readiness.tip && <p>{g.readiness.tip}</p>}
        <p>
          See what the light means on other models in <Link href="/guides/aed-status-light">our status light guide</Link>.
        </p>

        <h2 id="serial">2. Find the serial number</h2>
        <p>{g.serial.where}</p>
        <h3>How old is your {g.shortName}?</h3>
        <p>{g.serial.age}</p>
        <p>
          Age matters: many AED owners plan to replace a unit at around ten years, and an older unit may no longer
          be supported by its maker. More in <Link href="/guides/how-old-is-my-aed">how old is my AED</Link>.
        </p>

        <h2 id="pads">3. Check the pads expiry date</h2>
        <p>{g.pads.where}</p>
        <p>
          Replace the {g.pads.name === 'pads' ? 'pads' : g.pads.name} if the date has passed, after any use (they are
          single-use), or if the package is open or damaged. Expired pads can dry out and may not stick or conduct
          properly. More in <Link href="/guides/aed-pads-expiry">AED pads expiry</Link>.
        </p>

        <h2 id="battery">4. Check the battery date</h2>
        <p>{g.battery.where}</p>
        {g.battery.note && <p>{g.battery.note}</p>}
        <p>
          More in <Link href="/guides/aed-battery-expiry">AED battery expiry</Link>.
        </p>

        <h2 id="battery-fitted">5. Make sure the battery is fitted</h2>
        <p>{g.batteryFitted}</p>

        <h2 id="pads-connected">6. Make sure the pads are connected</h2>
        <p>{g.padsConnected}</p>

        <h2 id="child">Child pads or key</h2>
        <p>{g.child}</p>

        <h2 id="accessories">The cabinet, rescue kit and emergency sign</h2>
        <ul>
          <li>
            <strong>Cabinet or case:</strong> easy to reach, not locked or blocked, and the alarm working if it has one.
          </li>
          <li>
            <strong>Rescue kit:</strong> gloves, a razor, scissors and a CPR face mask, sealed and with the AED.
          </li>
          <li>
            <strong>Emergency contacts sticker:</strong> on the AED or its cabinet, with your local emergency number.
          </li>
        </ul>

        <h2 id="if-it-fails">If something fails</h2>
        <p>
          Many faults take seconds to fix: push the battery fully home, plug the pads back in, close the lid, then check
          the readiness light again. An expired battery or pads can’t be fixed on the spot and need replacing. The free
          inspection’s report lists exactly what failed, and you can ask for a quote for the right pads or battery for
          your {g.shortName} from the result screen.
        </p>
      </article>

      <section className="mt-12" aria-labelledby="faq">
        <h2 id="faq" className="mb-3 text-title text-foreground">
          {g.fullName}: common questions
        </h2>
        <FaqList faqs={g.faqs} />
      </section>

      <InspectCta
        className="mt-10"
        href={href}
        title={`Inspect your ${g.shortName} now`}
        buttonLabel={`Inspect my ${g.shortName}`}
      />

      <section className="no-print mt-12" aria-labelledby="other-models">
        <h2 id="other-models" className="mb-3 text-title text-foreground">
          Other AED models
        </h2>
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {related.map((o) => (
            <li key={o.slug}>
              <Link href={`/aed/${o.slug}`} className="surface-tile pressable flex h-full flex-col items-center p-3 text-center">
                <img
                  src={DEVICE_PHOTO[o.id]?.tile ?? o.photo}
                  width={96}
                  height={96}
                  alt=""
                  loading="lazy"
                  className="h-24 w-24 rounded-2xl bg-white object-contain p-1"
                />
                <span className="mt-2 text-callout font-medium text-foreground">{o.fullName.replace('Cardiac Science ', '')}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-callout">
          <Link href="/aed" className="font-medium text-primary hover:underline">
            All AED models
          </Link>
        </p>
      </section>
    </SitePage>
  );
}
