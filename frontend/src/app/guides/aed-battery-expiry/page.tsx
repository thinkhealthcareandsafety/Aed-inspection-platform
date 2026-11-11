import Link from 'next/link';
import { GuideLayout, guideMetadata } from '@/components/site/GuideLayout';
import { MODEL_GUIDES } from '@/lib/seo/models';

const SLUG = 'aed-battery-expiry';
export const metadata = guideMetadata(SLUG);

const FAQS = [
  {
    q: 'How long does an AED battery last?',
    a: 'Most are designed to last around four to five years in standby, less if the AED has been used a lot or kept somewhere very hot or cold. Go by your battery’s own label.',
  },
  {
    q: 'Can I recharge an AED battery?',
    a: 'No. AED batteries are non-rechargeable lithium packs. Never try to recharge one, and only fit the battery your AED’s maker specifies.',
  },
  {
    q: 'What does “Install before” mean on a Philips AED battery?',
    a: 'It is the last date a new battery should be fitted. It applies to a spare in its packaging. Once a battery is in the AED, the AED’s own self-tests keep watch on it.',
  },
  {
    q: 'How do I know my AED battery is low?',
    a: 'The readiness indicator stops showing ready, and many AEDs chirp or beep. That is why the monthly check starts with the readiness light.',
  },
];

export default function BatteryExpiryGuide() {
  return (
    <GuideLayout
      slug={SLUG}
      faqs={FAQS}
      intro={
        <p>
          An AED battery sits in standby for years, then has to deliver every shock in a rescue. Its label tells you how
          long it has left, but makers word that label differently. Here is what each one means, and where to find it.
        </p>
      }
    >
      <h2 id="how-long">How long AED batteries last</h2>
      <p>
        Most AED batteries are <strong>designed to last around four to five years</strong> in standby. Heavy use, frequent
        self-tests and storage somewhere very hot or cold shorten that. The label on your battery, not a rule of thumb, is
        what to go by.
      </p>

      <h2 id="labels">Three kinds of battery label</h2>
      <ul>
        <li>
          <strong>“Install before” (Philips):</strong> the last date a new battery should be fitted. Don’t fit a spare
          that is past it.
        </li>
        <li>
          <strong>“Replace on or before”, “install by”, or a date beside ⌛ (ZOLL, Defibtech):</strong> the date to have
          a new battery in by.
        </li>
        <li>
          <strong>Date of manufacture (Powerheart):</strong> when the battery was made, not when it expires. Work out the
          replacement date from the battery life your supplier gives.
        </li>
      </ul>

      <h2 id="where">Where the battery date is, model by model</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">AED</th>
              <th scope="col">Where the battery date is</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_GUIDES.map((g) => (
              <tr key={g.slug}>
                <td>
                  <Link href={`/aed/${g.slug}#battery`}>{g.fullName.replace('Cardiac Science ', '')}</Link>
                </td>
                <td>{g.battery.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="fitted">Check it is fitted, too</h2>
      <p>
        A battery that isn’t pushed fully home can look fine and still not connect. It should sit flush with the case and
        click or latch into place. On the <Link href="/aed/zoll-aed-plus">ZOLL AED Plus</Link>, which runs on ten lithium
        cells, the compartment cover should be closed and latched, and all ten cells are replaced together.
      </p>

      <h2 id="when-to-replace">When to replace an AED battery</h2>
      <ul>
        <li>The date on its label has passed, or will before your next check.</li>
        <li>The readiness indicator shows a fault, or the AED chirps or beeps, and a battery problem is the cause.</li>
        <li>After a rescue, if the maker’s instructions say so.</li>
      </ul>
      <p>
        After fitting a new battery, check that the readiness light shows ready again. Recycle the old one as a lithium
        battery, not with general waste.
      </p>

      <h2 id="with-the-app">Let the app read the label</h2>
      <p>
        Photograph the battery label and the free app reads the date, works out what it means for your model, and checks
        a second photo to confirm the battery is fitted. Both go in your PDF report.
      </p>
    </GuideLayout>
  );
}
