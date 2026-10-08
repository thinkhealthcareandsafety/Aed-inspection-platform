/**
 * The in-app camera's blink counter, against generated footage of each case
 * it has to get right: blinks counted on every unit's colour, under a
 * shaking hand and on a slow phone; nothing counted for a steady green
 * button, a camera pan, a steady light or the dark.
 *
 *   npm run test:detector
 */
import { ReadinessDetector } from '../src/lib/readiness-detector.ts';

const S = 80;
type Scene = {
  flashEvery?: number;
  flashMs?: number;
  button?: boolean;
  shake?: number;
  pan?: number;
  steady?: boolean;
  dark?: boolean;
  /** Body colour: Defibtech yellow (bright, near 255 red) or Philips blue. */
  body?: 'yellow' | 'blue';
};

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

function frame(t: number, o: Scene): Uint8ClampedArray {
  const r = rng(Math.floor(t * 7) + 1);
  const d = new Uint8ClampedArray(S * S * 4);
  const ox = o.shake ? Math.round(Math.sin(t / 90) * o.shake) : o.pan ? Math.round((t / 1000) * o.pan) : 0;
  const lit = Boolean(o.flashEvery && t % o.flashEvery < (o.flashMs ?? 120) && t > 500) || Boolean(o.steady);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const p = (y * S + x) * 4;
      let [R, G, B] = o.body === 'blue' ? [40, 70, 130] : [250, 205, 40];
      if (o.dark) [R, G, B] = [12, 10, 5];
      const xx = x + ox;
      const inLight = (xx - 40) ** 2 + (y - 40) ** 2 <= 9;
      if (inLight) [R, G, B] = [150, 160, 150];
      if (o.button && (xx - 60) ** 2 + (y - 55) ** 2 <= 36) [R, G, B] = [40, 190, 60];
      if (o.pan && (xx - 75) ** 2 + (y - 20) ** 2 <= 16) [R, G, B] = [60, 230, 80];
      // An LED replaces the colour where it shines with its own green.
      if (lit && inLight) [R, G, B] = [110, 255, 130];
      const nz = (r() - 0.5) * 8;
      d[p] = R + nz;
      d[p + 1] = G + nz;
      d[p + 2] = B + nz;
      d[p + 3] = 255;
    }
  }
  return d;
}

function blinks(o: Scene, secs = 12, fps = 30): number {
  const det = new ReadinessDetector(S);
  let flashes = 0;
  for (let t = 0; t < secs * 1000; t += 1000 / fps) flashes = det.push(frame(t, o), t).flashes;
  return flashes;
}

const cases: [string, Scene, number, number?][] = [
  ['Defibtech yellow: blink every 5 s', { flashEvery: 5000, button: true }, 2],
  ['Philips blue: 100 ms blink every 3 s', { flashEvery: 3000, flashMs: 100, button: true, body: 'blue' }, 3],
  ['Slow phone, 15 fps', { flashEvery: 3000, flashMs: 150, button: true }, 3, 15],
  ['Blinks under a shaking hand', { flashEvery: 5000, button: true, shake: 3 }, 2],
  ['No blink: green button, shaking hand', { button: true, shake: 3 }, 0],
  ['No blink: a pan brings green into view', { button: true, pan: 6 }, 0],
  ['No blink: a steady green light', { steady: true }, 0],
  ['No blink: too dark', { dark: true }, 0],
];

let failed = 0;
for (const [name, scene, want, fps] of cases) {
  const got = blinks(scene, 12, fps ?? 30);
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}: ${got} blinks (want ${want})`);
}
if (failed) {
  console.error(`${failed} of ${cases.length} failed`);
  process.exit(1);
}
console.log(`all ${cases.length} passed`);
