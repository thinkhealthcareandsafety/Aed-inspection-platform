import Link from 'next/link';
import { GuideLayout, guideMetadata } from '@/components/site/GuideLayout';
import { PrintButton } from '@/components/site/PrintButton';

const SLUG = 'aed-inspection-checklist';
export const metadata = guideMetadata(SLUG);

const CHECKS: { check: string; pass: string; link?: { href: string; text: string } }[] = [
  {
    check: 'Readiness indicator',
    pass: 'Shows ready: a blinking green light, a green ✓ or a steady green light, depending on the model.',
    link: { href: '/guides/aed-status-light', text: 'What each light means' },
  },
  {
    check: 'Serial number',
    pass: 'The label is there and readable. Note the number in your log: it also tells you how old the AED is.',
    link: { href: '/guides/how-old-is-my-aed', text: 'Read its age' },
  },
  {
    check: 'Pads expiry',
    pass: 'The date on the pads package has not passed, and the package is sealed and undamaged.',
    link: { href: '/guides/aed-pads-expiry', text: 'Where the date is' },
  },
  {
    check: 'Battery expiry',
    pass: 'The date on the battery label has not passed.',
    link: { href: '/guides/aed-battery-expiry', text: 'What the label means' },
  },
  { check: 'Battery fitted', pass: 'The battery is pushed fully in, flush with the case, and latched where there is a latch.' },
  { check: 'Pads connected', pass: 'The pads are plugged into the AED (or the cartridge is fitted) so they are ready when the lid opens.' },
  {
    check: 'Child pads or key',
    pass: 'If the AED has them: present, in date, and kept beside the AED. They are for children under 8 or under 25 kg.',
  },
  { check: 'Cabinet or case', pass: 'Easy to reach, not blocked or locked shut, clearly signed, and its alarm works if it has one.' },
  { check: 'Rescue kit', pass: 'Gloves, a razor, scissors and a CPR face mask, sealed and kept with the AED.' },
  { check: 'Emergency contacts sticker', pass: 'On the AED or its cabinet and readable, with your local emergency number.' },
];

const FAQS = [
  {
    q: 'How often should an AED be inspected?',
    a: 'At least once a month, plus after every use, after the AED has been moved, and whenever a pads or battery date is close. Follow your AED maker’s schedule if it asks for more.',
  },
  {
    q: 'Who can inspect an AED?',
    a: 'Anyone responsible for it. A monthly visual inspection needs no tools or technical training, just the AED and a few minutes. Repairs and servicing beyond that are for the manufacturer or an authorised service provider.',
  },
  {
    q: 'My AED tests itself. Do I still need to inspect it?',
    a: 'Yes. A self-test checks the AED’s own electronics, but it can’t see that the spare pads have expired, the rescue kit is missing, or the cabinet is blocked. Only a person looking at it can.',
  },
  {
    q: 'Should I keep a record of AED inspections?',
    a: 'Yes. A dated log of each check, who did it and what was found shows the AED has been looked after, and makes it easy to see when pads and batteries are due. The free inspection app emails a PDF report you can keep as that record.',
  },
];

export default function ChecklistGuide() {
  return (
    <GuideLayout
      slug={SLUG}
      faqs={FAQS}
      intro={
        <p>
          An AED tests itself, but it can’t tell you that its pads have expired, the rescue kit has gone missing or the
          cabinet is blocked. A monthly look catches all three. These are the ten checks, in the order that makes sense
          standing in front of the AED.
        </p>
      }
    >
      <h2 id="how-often">How often to inspect an AED</h2>
      <p>
        Check it <strong>at least once a month</strong>. Also check it after every use, after it has been moved, and
        whenever a pads or battery date is coming up. A routine check takes a few minutes, and your AED maker’s
        instructions come first if they ask for more.
      </p>

      <h2 id="checklist">The 10-point AED inspection checklist</h2>
      <p>
        The first six are essential on every AED. The last four apply if your AED has them, and most sites do.
      </p>
      <ol>
        {CHECKS.map((c) => (
          <li key={c.check}>
            <strong>{c.check}.</strong> {c.pass}
            {c.link && (
              <>
                {' '}
                <Link href={c.link.href}>{c.link.text}</Link>.
              </>
            )}
          </li>
        ))}
      </ol>
      <p>
        Each model hides its dates in different places. The <Link href="/aed">guide for your model</Link> shows exactly
        where.
      </p>

      <h2 id="printable">Printable AED inspection checklist</h2>
      <p>Print this and keep it with the AED, or use the free app and let the report be your record.</p>
      <PrintButton />
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">Check</th>
              <th scope="col">Pass?</th>
              <th scope="col">Notes</th>
            </tr>
          </thead>
          <tbody>
            {CHECKS.map((c) => (
              <tr key={c.check}>
                <td>{c.check}</td>
                <td aria-label="Pass or fail">☐ Yes ☐ No</td>
                <td />
              </tr>
            ))}
            <tr>
              <td>Date and inspected by</td>
              <td colSpan={2} />
            </tr>
          </tbody>
        </table>
      </div>

      <h2 id="if-it-fails">What to do when a check fails</h2>
      <ul>
        <li>
          <strong>Not showing ready:</strong> check that the battery is fully fitted and the pads are plugged in, then
          look again. If it still isn’t ready, contact your supplier, put a notice on the cabinet, and tell people where
          the nearest working AED is.
        </li>
        <li>
          <strong>Pads or battery past their date:</strong> replace them. Order a month or two before the date, so the
          new ones arrive in time.
        </li>
        <li>
          <strong>Missing rescue kit or sticker:</strong> replace them. They’re cheap, and a razor or scissors can be the
          difference in getting the pads on quickly.
        </li>
      </ul>

      <h2 id="with-the-app">Run the checklist on your phone</h2>
      <p>
        AED SmartX Inspector walks you through these ten checks with your phone’s camera. It films the readiness light,
        reads the serial number and every expiry date with AI, scores the AED out of 100, and emails you a PDF report.
        The quick check (readiness light and serial number) takes about a minute; the full inspection, about six. It’s
        free, in English and Hindi.
      </p>
    </GuideLayout>
  );
}
