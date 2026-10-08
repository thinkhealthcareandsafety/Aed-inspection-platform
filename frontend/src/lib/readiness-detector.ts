/**
 * The Ready light's blinks, counted live on the phone while it films.
 *
 * The same test the server's scan uses (python-cv readiness_frames.py), run
 * on the small patch of the picture inside the on-screen circle: a flash is
 * a spot that turns vividly green and bright — more so than anything that is
 * usually around it — and then goes dark again within 0.7 s.
 *
 * It only guides. It tells the person they have the light in the circle and
 * stops the recording once two blinks are on it; the verdict is still the
 * server's, from the clip itself. So it errs towards silence: a jolt of the
 * hand or a green button sliding into view must not be counted as a blink.
 */

/** Same thresholds as the server's scan. */
const MIN_GREEN = 45;
const MIN_BRIGHT = 140;
const GREENER_BY = 20;
const BRIGHTER_BY = 15;
/** ...or this much greener and no dimmer than its surroundings: on a bright
 *  yellow Defibtech the light can't outshine the casing, but yellow has no
 *  greenness to begin with — while a dull green button edge is dimmer. */
const STRONGLY_GREENER_BY = 40;
const NO_DIMMER_BY = 8;
/** A blink, not a steady light or the scene changing. */
const MAX_FLASH_MS = 700;
/** Dark for this long before and after a flash. */
const DARK_AROUND_MS = 200;
/** How fast the usual picture follows the scene: slowly while still (so a
 *  flash never becomes part of it), at once when the phone moves. */
const SETTLE_ALPHA = 0.06;
const MOVING_ALPHA = 0.5;
/** Lit pixels join the usual picture only slowly — a steady light or a green
 *  thing panned into view stops looking new within a couple of seconds. */
const LIT_ALPHA = 0.02;
/** Frames spent learning the usual picture before anything counts. */
const WARMUP_FRAMES = 8;
/** How far around each pixel counts as "usually around it" (as the
 *  server's 5x5 neighbourhood): a green button sliding a pixel or two under
 *  a shaking hand stays within its own neighbourhood and is never lit. */
const NEAR = 2;
/** Mean brightness change per pixel past which the phone is moving. */
const SHAKY_DIFF = 14;
/** Below this mean brightness, too dark to see a light switch on. */
const DARK_MEAN = 28;
/** Past this share of blown-out pixels, glare hides the light. */
const GLARE_SHARE = 0.3;
/** A light, not a scene change: at most this share of the patch lit, and
 *  gathered within this share of its side. */
const MAX_LIT_SHARE = 0.12;
const MAX_SPOT_SIDE = 0.45;
/** Steadying the hand: the largest shift between frames searched for, and
 *  the furthest the picture is followed before it counts as re-aimed. */
const MAX_STEP = 3;
const MAX_DRIFT = 12;

export type CaptureQuality = 'ok' | 'dark' | 'glare' | 'shaky';

export interface DetectorReport {
  /** Separate blinks seen so far. */
  flashes: number;
  /** When the last blink was confirmed, in the caller's clock (ms). */
  lastFlashAt: number | null;
  /** The spot is lit in this frame. */
  lit: boolean;
  quality: CaptureQuality;
}

export class ReadinessDetector {
  private readonly n: number;
  private readonly bgGreen: Float32Array;
  private readonly bgBright: Float32Array;
  private readonly prevLuma: Float32Array;
  private readonly green: Uint8Array;
  private readonly bright: Uint8Array;
  private frames = 0;
  private inRun = false;
  private runStart = 0;
  private runFrames = 0;
  private darkSince = 0;
  private runAfterDark = false;
  private pendingEnd: number | null = null;
  private lastT: number | null = null;
  private flashes = 0;
  private lastFlashAt: number | null = null;
  private quality: CaptureQuality = 'ok';
  private readonly rawLuma: Float32Array;
  private readonly prevRawLuma: Float32Array;
  /** How far the scene has drifted in the patch since the usual picture was
   *  learnt; each frame is read back from that far away, so it lines up. */
  private offX = 0;
  private offY = 0;

  private readonly size: number;

  /** `size`: the side, in pixels, of the square patch passed to `push`. */
  constructor(size: number) {
    this.size = size;
    this.n = size * size;
    this.bgGreen = new Float32Array(this.n);
    this.bgBright = new Float32Array(this.n);
    this.prevLuma = new Float32Array(this.n);
    this.green = new Uint8Array(this.n);
    this.bright = new Uint8Array(this.n);
    this.rawLuma = new Float32Array(this.n);
    this.prevRawLuma = new Float32Array(this.n);
  }

  /** The shift (in patch pixels) that best lines this frame up with the
   *  last — a sum of differences over a sparse grid, searched ±MAX_STEP. */
  private frameShift(): [number, number] {
    const { size, rawLuma, prevRawLuma } = this;
    let best = Infinity;
    let bx = 0;
    let by = 0;
    const lo = MAX_STEP;
    const hi = size - MAX_STEP;
    for (let dy = -MAX_STEP; dy <= MAX_STEP; dy++) {
      for (let dx = -MAX_STEP; dx <= MAX_STEP; dx++) {
        let sad = 0;
        for (let y = lo; y < hi; y += 2) {
          const row = y * size;
          const rowShifted = (y + dy) * size + dx;
          for (let x = lo; x < hi; x += 2) sad += Math.abs(prevRawLuma[row + x] - rawLuma[rowShifted + x]);
        }
        // A shift must beat standing still clearly, or noise moves the picture.
        if (dx === 0 && dy === 0) sad *= 0.97;
        if (sad < best) {
          best = sad;
          bx = dx;
          by = dy;
        }
      }
    }
    return [bx, by];
  }

  reset(): void {
    this.frames = 0;
    this.inRun = false;
    this.pendingEnd = null;
    this.lastT = null;
    this.flashes = 0;
    this.lastFlashAt = null;
    this.quality = 'ok';
    this.offX = 0;
    this.offY = 0;
  }

  /** One frame's patch, as RGBA from a canvas, at time `t` (ms). */
  push(rgba: Uint8ClampedArray, t: number): DetectorReport {
    const { n, size, green, bright, bgGreen, bgBright, prevLuma } = this;
    const interval = this.lastT === null ? 33 : t - this.lastT;
    this.lastT = t;

    const first = this.frames === 0;
    const { rawLuma, prevRawLuma } = this;
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      rawLuma[i] = (rgba[p] * 3 + rgba[p + 1] * 6 + rgba[p + 2]) / 10;
    }
    // Steady the hand: follow the scene as it drifts in the patch, and read
    // each frame back from where the scene now is.
    let reaimed = false;
    if (!first) {
      const [dx, dy] = this.frameShift();
      this.offX += dx;
      this.offY += dy;
      if (Math.abs(this.offX) > MAX_DRIFT || Math.abs(this.offY) > MAX_DRIFT) {
        this.offX = 0;
        this.offY = 0;
        reaimed = true;
      }
    }
    prevRawLuma.set(rawLuma);
    const ox = this.offX;
    const oy = this.offY;

    let lumaSum = 0;
    let diffSum = 0;
    let blown = 0;
    for (let y = 0, i = 0; y < size; y++) {
      const sy = Math.min(size - 1, Math.max(0, y + oy));
      for (let x = 0; x < size; x++, i++) {
        const sx = Math.min(size - 1, Math.max(0, x + ox));
        const p = (sy * size + sx) * 4;
        const r = rgba[p];
        const g = rgba[p + 1];
        const b = rgba[p + 2];
        green[i] = Math.max(0, g - Math.max(r, b));
        bright[i] = Math.max(r, g, b);
        const luma = (r * 3 + g * 6 + b) / 10;
        lumaSum += luma;
        diffSum += Math.abs(luma - prevLuma[i]);
        prevLuma[i] = luma;
        if (r > 245 && g > 245 && b > 245) blown++;
      }
    }
    this.frames++;
    const mean = lumaSum / n;
    const shaky = !first && (reaimed || diffSum / n > SHAKY_DIFF);
    this.quality = shaky ? 'shaky' : mean < DARK_MEAN ? 'dark' : blown / n > GLARE_SHARE ? 'glare' : 'ok';

    if (first || reaimed) {
      // A new aim is a new scene: learn it afresh before judging anything.
      bgGreen.set(green);
      bgBright.set(bright);
      if (reaimed) {
        this.frames = 1;
        this.track(false, t, interval, true);
      }
      return this.report(false);
    }
    const learning = this.frames <= WARMUP_FRAMES;

    // Lit pixels, judged against the brightest, greenest thing usually in
    // their neighbourhood — so a green button that shifts a little isn't lit.
    let litCount = 0;
    let minX = size;
    let minY = size;
    let maxX = -1;
    let maxY = -1;
    const lit = new Uint8Array(n);
    if (!learning && !shaky) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const i = y * size + x;
          if (green[i] < MIN_GREEN || bright[i] < MIN_BRIGHT) continue;
          let nearGreen = 0;
          let nearBright = 0;
          for (let dy = -NEAR; dy <= NEAR; dy++) {
            const yy = y + dy;
            if (yy < 0 || yy >= size) continue;
            for (let dx = -NEAR; dx <= NEAR; dx++) {
              const xx = x + dx;
              if (xx < 0 || xx >= size) continue;
              const j = yy * size + xx;
              if (bgGreen[j] > nearGreen) nearGreen = bgGreen[j];
              if (bgBright[j] > nearBright) nearBright = bgBright[j];
            }
          }
          const greener = green[i] - nearGreen;
          const brighter = bright[i] - nearBright;
          if (
            greener > GREENER_BY &&
            (brighter > BRIGHTER_BY || (greener > STRONGLY_GREENER_BY && brighter >= -NO_DIMMER_BY))
          ) {
            lit[i] = 1;
            litCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }

    // The usual picture follows the scene; lit pixels join it only slowly.
    const alpha = learning ? 0.3 : shaky ? MOVING_ALPHA : SETTLE_ALPHA;
    for (let i = 0; i < n; i++) {
      const a = lit[i] ? LIT_ALPHA : alpha;
      bgGreen[i] += a * (green[i] - bgGreen[i]);
      bgBright[i] += a * (bright[i] - bgBright[i]);
    }

    const spot =
      litCount >= 2 &&
      litCount <= MAX_LIT_SHARE * n &&
      Math.max(maxX - minX, maxY - minY) + 1 <= Math.max(4, MAX_SPOT_SIDE * size);
    this.track(spot, t, interval, shaky || learning);
    return this.report(spot);
  }

  private track(spot: boolean, t: number, interval: number, unreliable: boolean): void {
    if (unreliable) {
      // Nothing seen while the phone moves is evidence either way.
      this.inRun = false;
      this.pendingEnd = null;
      this.darkSince = t;
      return;
    }
    if (spot) {
      this.pendingEnd = null;
      if (!this.inRun) {
        this.inRun = true;
        this.runStart = t;
        this.runFrames = 0;
        this.runAfterDark = t - this.darkSince >= DARK_AROUND_MS;
      }
      this.runFrames++;
      return;
    }
    if (this.inRun) {
      this.inRun = false;
      const lasted = t - this.runStart;
      // Two frames lit, or one on a phone filming slowly; and brief.
      const enoughFrames = this.runFrames >= 2 || interval > 60;
      if (this.runAfterDark && enoughFrames && lasted <= MAX_FLASH_MS) this.pendingEnd = t;
      this.darkSince = t;
    }
    // Confirmed once it has stayed dark after the blink.
    if (this.pendingEnd !== null && t - this.pendingEnd >= DARK_AROUND_MS) {
      this.flashes++;
      this.lastFlashAt = this.pendingEnd;
      this.pendingEnd = null;
    }
  }

  private report(lit: boolean): DetectorReport {
    return { flashes: this.flashes, lastFlashAt: this.lastFlashAt, lit, quality: this.quality };
  }
}
