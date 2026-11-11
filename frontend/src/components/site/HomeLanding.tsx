/* eslint-disable @next/next/no-img-element */
import Link from 'next/link';
import { ArrowUp, ChevronRight } from 'lucide-react';
import { FaqList } from './content';
import { CHECKLIST_ITEMS } from '@/lib/checklist-config';
import { MODEL_GUIDES, OTHER_BRANDS_LINE } from '@/lib/seo/models';
import { GUIDES } from '@/lib/seo/guides';
import { DEVICE_PHOTO } from '@/lib/device-photos';

export const HOME_FAQS = [
  {
    q: 'Is the AED inspection really free?',
    a: 'Yes. There is no charge and no card. Your details are used to send you the report, and nothing else.',
  },
  {
    q: 'Which AEDs does it work with?',
    a: `Philips HeartStart FRx and HS1 (OnSite), ZOLL AED Plus and AED 3, Powerheart G3 and G5, and Defibtech Lifeline, Lifeline AUTO, VIEW and ECG. For ${OTHER_BRANDS_LINE}, choose “My AED isn’t listed” and our team will help you inspect it.`,
  },
  {
    q: 'How long does it take?',
    a: 'About a minute for the quick check (the readiness light and serial number), and about six minutes for the full ten-point inspection. A quick check can always be turned into a full one.',
  },
  {
    q: 'What do I get at the end?',
    a: 'A score out of 100, a pass or fail for every check with its photo, what to fix, and a PDF report emailed to you to keep as your inspection record.',
  },
  {
    q: 'How often should I inspect my AED?',
    a: 'At least once a month, and after every use or move. Monthly checks catch expired pads and batteries before they are needed.',
  },
  {
    q: 'Does it work in Hindi?',
    a: 'Yes. Switch to हिन्दी at the top of the screen. Each check’s instructions can also be read aloud.',
  },
  {
    q: 'Are my photos shared?',
    a: 'No. Your photos are never shared or published. They are used to check your AED and to build your report.',
  },
  {
    q: 'Does this replace manufacturer servicing?',
    a: 'No. It is the routine visual inspection an AED owner should do every month. Repairs and servicing are for the manufacturer or an authorised service provider.',
  },
];

const STEPS = [
  { title: 'Tell us where to send the report', body: 'Your name, email and mobile number. Nothing else.' },
  { title: 'Pick your AED', body: 'Every check and example photo is matched to that exact model.' },
  {
    title: 'Follow the camera',
    body: 'Film the readiness light and photograph each label. AI reads them as you go and the PDF report is emailed when you finish.',
  },
];

/**
 * What sits under the form on the home page: what the inspection is, what it
 * checks, and the way into every model and guide page. Server-rendered, so it
 * is in the HTML search engines and AI assistants read, and it costs the
 * visitor no JavaScript. It answers the questions a stranger has before they
 * type their number in, then sends them back up to the form.
 */
export function HomeLanding() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-6 pt-10">
      <section aria-labelledby="what">
        <h2 id="what" className="text-title text-foreground">
          A free AED inspection, checked by AI
        </h2>
        <p className="mt-2 text-body text-muted-foreground">
          An AED tests itself, but a self-test can’t see expired spare pads, a missing rescue kit or a cabinet nobody can
          open. AED SmartX Inspector walks you through every check on your phone, reads each label and date with AI, and
          emails you a PDF report. No app to install, no account.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="how">
        <h2 id="how" className="text-title text-foreground">
          How it works
        </h2>
        <ol className="mt-4 space-y-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-3.5">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-callout font-semibold text-primary-foreground">
                {i + 1}
              </span>
              <span>
                <span className="block text-headline text-foreground">{s.title}</span>
                <span className="mt-0.5 block text-callout text-muted-foreground">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="checks">
        <h2 id="checks" className="text-title text-foreground">
          The ten checks
        </h2>
        <p className="mt-2 text-callout text-muted-foreground">
          The quick check is the first two. The full inspection is all ten, and the last four can be skipped if your site
          doesn’t have them. <Link href="/guides/aed-inspection-checklist" className="font-medium text-primary hover:underline">See the full checklist</Link>.
        </p>
        <ol className="surface-group mt-4">
          {CHECKLIST_ITEMS.map((item, i) => (
            <li key={item.id} className="surface-row flex gap-3 px-4 py-3">
              <span className="w-5 shrink-0 text-callout font-semibold tabular-nums text-muted-foreground">{i + 1}</span>
              <span>
                <span className="block text-body font-medium text-foreground">{item.title}</span>
                {!item.required && <span className="block text-footnote text-muted-foreground">If you have one</span>}
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10" aria-labelledby="models">
        <h2 id="models" className="text-title text-foreground">
          AEDs it inspects
        </h2>
        <p className="mt-2 text-callout text-muted-foreground">
          Tap your model for its inspection guide: where the light is and where every date is printed.
        </p>
        <ul className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
          {MODEL_GUIDES.map((g) => (
            <li key={g.slug}>
              <Link
                href={`/aed/${g.slug}`}
                className="surface-tile pressable flex h-full flex-col items-center p-2.5 text-center"
              >
                <img
                  src={DEVICE_PHOTO[g.id]?.tile ?? g.photo}
                  width={80}
                  height={80}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  className="h-20 w-20 rounded-xl bg-white object-contain p-1"
                />
                <span className="mt-1.5 text-footnote font-medium leading-snug text-foreground">
                  {g.fullName.replace('Cardiac Science ', '')}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-footnote text-muted-foreground">
          Another brand? {OTHER_BRANDS_LINE}: choose “My AED isn’t listed” and our team will help.
        </p>
      </section>

      <section className="mt-10" aria-labelledby="guides">
        <h2 id="guides" className="text-title text-foreground">
          AED guides
        </h2>
        <ul className="surface-group mt-4">
          {GUIDES.map((g) => (
            <li key={g.slug} className="surface-row">
              <Link
                href={`/guides/${g.slug}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-foreground">{g.heading}</span>
                  <span className="block text-footnote text-muted-foreground">{g.blurb}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="faq">
        <h2 id="faq" className="mb-4 text-title text-foreground">
          Questions
        </h2>
        <FaqList faqs={HOME_FAQS} />
      </section>

      <div className="mt-10 flex justify-center">
        <a
          href="#start"
          className="pressable inline-flex h-12 items-center gap-2 rounded-2xl bg-primary px-6 text-headline text-primary-foreground transition-colors hover:bg-primary/92"
        >
          <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.2} />
          Start free inspection
        </a>
      </div>
    </div>
  );
}
