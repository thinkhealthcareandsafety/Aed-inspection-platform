import Link from 'next/link';
import { GuideLayout, guideMetadata } from '@/components/site/GuideLayout';
import { MODEL_GUIDES } from '@/lib/seo/models';

const SLUG = 'aed-pads-expiry';
export const metadata = guideMetadata(SLUG);

const FAQS = [
  {
    q: 'How long do AED pads last?',
    a: 'Usually two to five years from when they were made, depending on the brand. Go by the date printed on the package, not the date you bought them.',
  },
  {
    q: 'Can I use expired AED pads?',
    a: 'In a real emergency, don’t let a date stop you: call for help, use the AED and follow its prompts. But never leave expired pads in place. Replace them as soon as you find them.',
  },
  {
    q: 'Are AED pads reusable?',
    a: 'No. Pads are single-use. Replace them after every use, even if they were only stuck on for a moment.',
  },
  {
    q: 'Do child AED pads expire?',
    a: 'Yes. Child (paediatric) pads have their own date, so check spare child pads on the same schedule as the adult ones.',
  },
];

export default function PadsExpiryGuide() {
  return (
    <GuideLayout
      slug={SLUG}
      faqs={FAQS}
      intro={
        <p>
          Expired pads are easy to miss: the date is small, and on some models it is tucked behind the AED. Here is where
          to find it on each model, and when pads must be replaced.
        </p>
      }
    >
      <h2 id="why">Why AED pads expire</h2>
      <p>
        AED pads carry a conductive gel that dries out over time. Past its date, a pad may not stick to the skin or
        conduct properly, which can stop the shock working as it should. The packaging also protects the gel, which is
        why a torn or opened package means replacing the pads too.
      </p>

      <h2 id="how-long">How long AED pads last</h2>
      <p>
        <strong>Usually two to five years</strong> from when they were made, depending on the brand. The date that counts
        is the one printed on the package, usually beside an hourglass symbol (⌛). It is the last day the pads should be
        relied on.
      </p>

      <h2 id="where">Where the pads date is, model by model</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">AED</th>
              <th scope="col">Where the pads expiry date is</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_GUIDES.map((g) => (
              <tr key={g.slug}>
                <td>
                  <Link href={`/aed/${g.slug}#pads`}>{g.fullName.replace('Cardiac Science ', '')}</Link>
                </td>
                <td>{g.pads.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="when-to-replace">When to replace AED pads</h2>
      <ul>
        <li>
          <strong>The date has passed</strong>, or will before your next monthly check.
        </li>
        <li>
          <strong>After any use.</strong> Pads are single-use.
        </li>
        <li>
          <strong>The package is open, torn or damaged</strong>, or the gel looks dry.
        </li>
        <li>
          <strong>Spare and child pads</strong> have their own dates: check those too.
        </li>
      </ul>
      <p>
        Order a month or two before the date, so the new pads arrive in time. Buy the pads made for your AED model:
        pads from another model, or another brand, may not fit or work.
      </p>

      <h2 id="with-the-app">Let the app read the date</h2>
      <p>
        Photograph the pads package and the free app reads the expiry date for you, flags it if it has passed, and puts
        it in your PDF report. If the pads have expired, you can ask for a quote for the right replacement from the
        result screen.
      </p>
    </GuideLayout>
  );
}
