import Link from 'next/link';
import { GuideLayout, guideMetadata } from '@/components/site/GuideLayout';

const SLUG = 'how-old-is-my-aed';
export const metadata = guideMetadata(SLUG);

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const FAQS = [
  {
    q: 'How long does an AED last?',
    a: 'Many AEDs are designed for around ten years of service, with pads and batteries replaced along the way. Past that, or once the maker stops supplying parts and support for the model, plan to replace it.',
  },
  {
    q: 'Does an old AED still work?',
    a: 'It may, if it passes its self-tests and its pads and battery are in date. But parts and support for older models run out, so check with the maker or your supplier before relying on one that is ten or more years old.',
  },
  {
    q: 'Where is the serial number on my AED?',
    a: 'Usually on a label on the back or underneath, marked “SN”. Each model guide shows exactly where it is on that unit.',
  },
  {
    q: 'What does the factory symbol on an AED label mean?',
    a: 'The small factory outline is the standard symbol for date of manufacture: the date beside it is when that item was made.',
  },
];

export default function DeviceAgeGuide() {
  return (
    <GuideLayout
      slug={SLUG}
      faqs={FAQS}
      intro={
        <p>
          An AED’s age decides whether it’s still under warranty, still supported by its maker, and when to budget for a
          new one. Most people don’t know it. On many models the serial number says it, if you know how to read it.
        </p>
      }
    >
      <h2 id="philips">Philips HeartStart FRx and HS1</h2>
      <p>
        After the first letter come <strong>two digits for the year</strong>, then <strong>a letter for the month</strong>.
      </p>
      <ul>
        <li>
          <strong>B17C-00516</strong> was made in March 2017 (17 = 2017, C = March).
        </li>
        <li>
          <strong>A18A-06336</strong> was made in January 2018 (18 = 2018, A = January).
        </li>
      </ul>
      <p>
        The serial is on the “SN” label at the bottom of the back panel:{' '}
        <Link href="/aed/philips-heartstart-frx#serial">FRx</Link>, <Link href="/aed/philips-heartstart-hs1#serial">HS1</Link>.
      </p>

      <h2 id="zoll">ZOLL AED Plus and AED 3</h2>
      <p>
        On the <Link href="/aed/zoll-aed-plus#serial">AED Plus</Link>, the serial starts with <strong>X</strong>, then two
        digits for the year, then a letter for the month: <strong>X14K718292</strong> was made in November 2014.
      </p>
      <p>
        The <Link href="/aed/zoll-aed-3#serial">AED 3</Link> adds an <strong>A</strong> in front and follows the same
        pattern: <strong>AX19D…</strong> was made in April 2019.
      </p>

      <h2 id="month-letters">The month letters</h2>
      <p>Philips and ZOLL both use A to L for January to December:</p>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">Letter</th>
              <th scope="col">Month</th>
              <th scope="col">Letter</th>
              <th scope="col">Month</th>
            </tr>
          </thead>
          <tbody>
            {MONTHS.slice(0, 6).map((month, i) => (
              <tr key={month}>
                <td>
                  <strong>{String.fromCharCode(65 + i)}</strong>
                </td>
                <td>{month}</td>
                <td>
                  <strong>{String.fromCharCode(71 + i)}</strong>
                </td>
                <td>{MONTHS[i + 6]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="powerheart">Powerheart G3 and G5</h2>
      <p>
        The serial number carries no date. The <strong>manufacture date is printed beside the factory symbol</strong> on
        the same label: underneath the <Link href="/aed/powerheart-g3#serial">G3</Link>, on the back of the{' '}
        <Link href="/aed/powerheart-g5#serial">G5</Link>.
      </p>

      <h2 id="defibtech">Defibtech Lifeline models</h2>
      <p>
        The 9-digit serial has no date in it. Look for a date of manufacture on the label instead. Where the label is
        depends on the model: <Link href="/aed/defibtech-lifeline#serial">Lifeline</Link>,{' '}
        <Link href="/aed/defibtech-lifeline-auto#serial">AUTO</Link>,{' '}
        <Link href="/aed/defibtech-lifeline-view#serial">VIEW</Link>,{' '}
        <Link href="/aed/defibtech-lifeline-ecg#serial">ECG</Link>.
      </p>

      <h2 id="other-brands">Any other AED</h2>
      <p>
        Look for the small <strong>factory symbol</strong> on the serial label. It is the standard mark for date of
        manufacture, and the date beside it is when the AED was made.
      </p>

      <h2 id="what-age-means">What the age means</h2>
      <p>
        Many AEDs are designed for around ten years of service. As yours gets older, check whether it’s still under
        warranty, whether its maker still supplies pads, batteries and support for it, and plan for a replacement before
        it reaches the end of its life rather than after.
      </p>
      <p>
        The free app reads the serial number from a photo and tells you the AED’s age straight away. It only gives an age
        when the serial or label clearly shows one.
      </p>
    </GuideLayout>
  );
}
