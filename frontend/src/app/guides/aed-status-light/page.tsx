import Link from 'next/link';
import { GuideLayout, guideMetadata } from '@/components/site/GuideLayout';
import { MODEL_GUIDES } from '@/lib/seo/models';

const SLUG = 'aed-status-light';
export const metadata = guideMetadata(SLUG);

const FAQS = [
  {
    q: 'What does a blinking green light on an AED mean?',
    a: 'On AEDs with a blinking Ready light (Philips HeartStart and Defibtech Lifeline models), blinking green means the AED passed its last self-test and is ready to use.',
  },
  {
    q: 'What does a red light or a red X on an AED mean?',
    a: 'The AED needs attention and may not work. Check that the battery is fitted and in date and the pads are plugged in and in date. If it stays red, contact your supplier and tell people where the nearest working AED is.',
  },
  {
    q: 'My AED’s light is off. Is it ready?',
    a: 'Treat it as not ready. On models whose light blinks, watch for a full 10 seconds first: some only flash every five seconds or so.',
  },
  {
    q: 'Why is my AED beeping or chirping?',
    a: 'A chirp or beep on standby is the AED asking for attention, usually because of a low battery, a pads problem or a failed self-test. Check the readiness light, the battery and the pads.',
  },
];

export default function StatusLightGuide() {
  return (
    <GuideLayout
      slug={SLUG}
      faqs={FAQS}
      intro={
        <p>
          Every AED tests itself while it waits and shows the result on a small readiness indicator. Here is where it is
          on each model and what it should show, so you can tell ready from not ready at a glance.
        </p>
      }
    >
      <h2 id="rules">Four rules for any AED</h2>
      <ul>
        <li>
          <strong>It’s not the On/Off button.</strong> On Philips units the big green On/Off button is easy to mistake for
          the small Ready light.
        </li>
        <li>
          <strong>Watch for 10 seconds.</strong> Some lights blink only every five seconds or so. A glance can miss it.
        </li>
        <li>
          <strong>Red means attention.</strong> A red light, a red ✗, chirping or beeping all mean the AED may not work.
        </li>
        <li>
          <strong>No light means not ready.</strong> Treat a blank window or a light that never blinks as a fault.
        </li>
      </ul>

      <h2 id="by-model">The readiness light, model by model</h2>
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr>
              <th scope="col">AED</th>
              <th scope="col">Where to look</th>
              <th scope="col">Ready</th>
              <th scope="col">Not ready</th>
            </tr>
          </thead>
          <tbody>
            {MODEL_GUIDES.map((g) => (
              <tr key={g.slug}>
                <td>
                  <Link href={`/aed/${g.slug}#readiness`}>{g.fullName.replace('Cardiac Science ', '')}</Link>
                </td>
                <td>{g.readiness.where.charAt(0).toUpperCase() + g.readiness.where.slice(1)}</td>
                <td>{g.readiness.ready}</td>
                <td>{g.readiness.notReady}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 id="philips">Philips HeartStart: the blinking Ready light</h2>
      <p>
        The <Link href="/aed/philips-heartstart-frx">FRx</Link> and <Link href="/aed/philips-heartstart-hs1">HS1</Link>{' '}
        have a small green Ready light that blinks every few seconds when the AED is ready. If it stops blinking, the AED
        usually chirps too. That chirp is the AED asking for attention, often for its battery.
      </p>

      <h2 id="zoll">ZOLL: the green tick</h2>
      <p>
        The <Link href="/aed/zoll-aed-plus">AED Plus</Link> and <Link href="/aed/zoll-aed-3">AED 3</Link> show a steady
        green ✓ in a small status window. On the AED Plus a red ✗ means it failed a self-test, often because its ten
        batteries are low.
      </p>

      <h2 id="powerheart">Powerheart: the Rescue Ready light</h2>
      <p>
        The <Link href="/aed/powerheart-g3">G3</Link> and <Link href="/aed/powerheart-g5">G5</Link> have a round Rescue
        Ready light by the handle: green for ready, red for attention. Touching or opening the lid can turn it red for
        about five seconds, so look again after a moment before deciding it has failed.
      </p>

      <h2 id="defibtech">Defibtech Lifeline: the flashing light</h2>
      <p>
        Every Lifeline model flashes a small green light when ready: by the handle on the{' '}
        <Link href="/aed/defibtech-lifeline">Lifeline</Link> and <Link href="/aed/defibtech-lifeline-auto">AUTO</Link>,
        and just right of the On/Off button on the <Link href="/aed/defibtech-lifeline-view">VIEW</Link> and{' '}
        <Link href="/aed/defibtech-lifeline-ecg">ECG</Link>. Red means it needs attention.
      </p>

      <h2 id="ready-is-not-everything">“Ready” isn’t the whole check</h2>
      <p>
        A green light means the AED passed its own self-test. It doesn’t tell you the spare pads are in date, the rescue
        kit is there or the cabinet can be opened. Run the full{' '}
        <Link href="/guides/aed-inspection-checklist">AED inspection checklist</Link> once a month.
      </p>
      <p>
        Not sure what you’re seeing? The free app films the light for you and tells you whether it shows ready. Where a
        light blinks, it counts the blinks.
      </p>
    </GuideLayout>
  );
}
