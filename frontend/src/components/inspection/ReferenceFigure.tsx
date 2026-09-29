'use client';

import Image from 'next/image';
import { CheckCircle2, Maximize2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Focus, ReferenceExample } from '@/lib/reference-examples';

export const KIND: Record<
  ReferenceExample['kind'],
  { label: string; color: string; icon?: typeof CheckCircle2 }
> = {
  good: { label: 'Correct', color: 'var(--status-good)', icon: CheckCircle2 },
  bad: { label: 'Wrong', color: 'var(--status-critical)', icon: XCircle },
  // Labelled too: an unmarked photo directly above a camera button reads as
  // a live viewfinder, or as a capture that has already been taken.
  neutral: { label: 'Example', color: 'hsl(var(--muted-foreground))' },
};

type Corner = 'tr' | 'bl' | 'br';

const CORNER_CLASS: Record<Corner, string> = {
  tr: 'top-2.5 right-2.5',
  bl: 'bottom-2.5 left-2.5',
  br: 'bottom-2.5 right-2.5',
};

/** Only a part small enough to be hard to read gets a magnifier; a whole
 *  battery or cartridge is already big on screen. */
function wantsLoupe(f: Focus): boolean {
  return f.w <= 0.3 && f.h <= 0.3;
}

/** Breathing room around the marked part, so the ring doesn't sit on it. */
function padded(f: Focus): Focus {
  const px = 0.016;
  const py = 0.022;
  const x = Math.max(0, f.x - px);
  const y = Math.max(0, f.y - py);
  return { x, y, w: Math.min(1 - x, f.w + 2 * px), h: Math.min(1 - y, f.h + 2 * py) };
}

/** Whichever free corner is farthest from the part — the top-left one
 *  holds the Example/Correct/Wrong label. Distances in 4:3 space. */
function farthestCorner(f: Focus, taken?: Corner): Corner {
  const cx = (f.x + f.w / 2) * 4;
  const cy = (f.y + f.h / 2) * 3;
  // Insertion order breaks ties: bottom-right first.
  const points: Record<Corner, [number, number]> = { br: [4, 3], tr: [4, 0], bl: [0, 3] };
  return (Object.keys(points) as Corner[])
    .filter((c) => c !== taken)
    .sort((a, b) => Math.hypot(points[b][0] - cx, points[b][1] - cy) - Math.hypot(points[a][0] - cx, points[a][1] - cy))[0];
}

function Spotlight({ focus }: { focus: Focus }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute rounded-xl"
      style={{
        left: `${focus.x * 100}%`,
        top: `${focus.y * 100}%`,
        width: `${focus.w * 100}%`,
        height: `${focus.h * 100}%`,
        // One element dims everything else: a spread shadow the size of the
        // screen, clipped by the frame, with the part left as the hole.
        boxShadow: '0 0 0 100vmax rgb(12 14 22 / 0.36)',
      }}
    >
      <span className="absolute inset-0 rounded-xl ring-2 ring-white shadow-[0_0_0_4px_hsl(var(--primary)/0.5)]" />
      <span className="spot-pulse absolute inset-0 rounded-xl ring-2 ring-white" />
    </div>
  );
}

/**
 * A magnified view of the part, drawn from the same image — no second
 * download, and sized from the focus alone so it needs no measuring: the
 * image is scaled until the part fills most of the lens, then offset so the
 * part's centre sits in the lens's centre.
 */
function Loupe({ src, focus, corner, diameter }: { src: string; focus: Focus; corner: Corner; diameter: number }) {
  const fill = 0.8;
  // Rendered image width, capped so a tiny part isn't blown up past the
  // photo's real resolution into mush.
  const width = Math.min((fill * diameter) / Math.max(focus.w, focus.h * 0.75), diameter * 8.5);
  const height = width * 0.75;
  const cx = focus.x + focus.w / 2;
  const cy = focus.y + focus.h / 2;
  return (
    <div
      aria-hidden
      className={cn(
        'pointer-events-none absolute overflow-hidden rounded-full bg-white ring-[3px] ring-white shadow-[0_8px_22px_-6px_rgb(0_0_0/0.5)]',
        CORNER_CLASS[corner],
      )}
      style={{ width: diameter, height: diameter }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          maxWidth: 'none',
          width,
          height,
          left: diameter / 2 - cx * width,
          top: diameter / 2 - cy * height,
        }}
      />
    </div>
  );
}

/** How far a close-up of the focus can zoom: enough margin to keep the part
 *  recognisable in its surroundings, capped below the photo's real detail. */
export function closeupZoom(f: Focus): number {
  return Math.min(3.2, 1 / Math.max(f.w * 1.7, f.h * 1.7));
}

/**
 * The marked part filling the frame. This is what "enlarge" has to mean on a
 * phone: a dialog of the whole photo is barely wider than the inline one, so
 * tapping it used to show the same picture at the same size.
 */
export function ReferenceCloseup({ example }: { example: ReferenceExample & { focus: Focus } }) {
  const f = example.focus;
  const zoom = closeupZoom(f);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  // Centre the part, but never pan past the photo's own edge.
  const left = clamp(0.5 - (f.x + f.w / 2) * zoom, 1 - zoom, 0);
  const top = clamp(0.5 - (f.y + f.h / 2) * zoom, 1 - zoom, 0);

  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 dark:ring-white/10">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={example.src}
        alt={`Close-up: ${example.caption}`}
        draggable={false}
        style={{
          position: 'absolute',
          maxWidth: 'none',
          width: `${zoom * 100}%`,
          height: `${zoom * 100}%`,
          left: `${left * 100}%`,
          top: `${top * 100}%`,
        }}
      />
      <span className="absolute top-2.5 left-2.5 inline-flex items-center rounded-full bg-background/92 backdrop-blur-sm px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-sm ring-1 ring-black/5">
        Close-up
      </span>
    </div>
  );
}

/**
 * One reference photo, marked up: the part to look for is spotlit and ringed,
 * and — when it's small — shown again magnified in a lens. Replaces red boxes
 * burned into the photos, which read as "wrong" in an app where red means a
 * failed check, and which no two photos drew the same way.
 */
export function ReferenceFigure({
  example,
  size = 'md',
  priority,
  showLens = true,
  onOpen,
}: {
  example: ReferenceExample;
  size?: 'md' | 'lg';
  priority?: boolean;
  /** Off where a full close-up is already on screen. */
  showLens?: boolean;
  /** Makes the figure a button that enlarges it. */
  onOpen?: () => void;
}) {
  const { src, caption, kind, focus } = example;
  const k = KIND[kind];
  const KindIcon = k.icon;
  const lens = showLens && focus && wantsLoupe(focus) ? focus : undefined;
  const lensCorner = lens ? farthestCorner(lens) : undefined;
  const expandCorner = farthestCorner(focus ?? { x: 0.5, y: 0.5, w: 0, h: 0 }, lensCorner);

  return (
    <div className="relative w-full aspect-[4/3] overflow-hidden rounded-2xl bg-white ring-1 ring-black/5 dark:ring-white/10">
      {/* unoptimized: already sized and compressed at build time, so the
          on-demand optimiser would only add a cold-start hop. */}
      <Image
        src={src}
        alt={caption}
        fill
        unoptimized
        priority={priority}
        sizes={size === 'lg' ? '(max-width: 640px) 92vw, 480px' : '(max-width: 640px) 90vw, 420px'}
        className="object-cover"
      />

      {focus && <Spotlight focus={padded(focus)} />}
      {lens && lensCorner && (
        <Loupe src={src} focus={lens} corner={lensCorner} diameter={size === 'lg' ? 148 : 100} />
      )}

      <span
        className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-background/92 backdrop-blur-sm px-2 py-0.5 text-[11px] font-semibold shadow-sm ring-1 ring-black/5"
        style={{ color: k.color }}
      >
        {KindIcon && <KindIcon className="w-3 h-3" strokeWidth={2.6} />}
        {k.label}
      </span>

      {onOpen && (
        <>
          <button
            type="button"
            onClick={onOpen}
            aria-label={`Enlarge example: ${caption}`}
            className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rounded-2xl"
          />
          <span
            aria-hidden
            className={cn(
              'pointer-events-none absolute w-7 h-7 rounded-full bg-background/85 backdrop-blur-sm flex items-center justify-center text-foreground/70 shadow-sm',
              CORNER_CLASS[expandCorner],
            )}
          >
            <Maximize2 className="w-3.5 h-3.5" strokeWidth={2.2} />
          </span>
        </>
      )}
    </div>
  );
}
