'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { captionOf, getReferenceExamples } from '@/lib/reference-examples';
import { useI18n } from '@/i18n';
import { track } from '@/lib/track';
import { KIND, ReferenceFigure } from './ReferenceFigure';
import type { ChecklistItemId } from '@/types';

const ReferenceLightbox = dynamic(() => import('./ReferenceLightbox'), { ssr: false });

/**
 * The reference photo, shown inline rather than hidden behind a tap.
 *
 * Someone standing in front of an AED shouldn't have to guess what we mean by
 * "the pads expiry date", open a dialog to find out, and then dismiss it
 * before they can raise the camera. Showing the target next to the button is
 * the whole instruction, delivered before the question is asked.
 *
 * A right/wrong pair used to sit side by side at half width, too small to
 * see either. Each now gets the full width, with a Correct / Wrong switch
 * above that also follows a swipe.
 */
export function ReferenceStrip({
  itemId,
  aedModel,
  className,
}: {
  itemId: ChecklistItemId;
  aedModel?: string;
  className?: string;
}) {
  const { lang, m } = useI18n();
  const examples = getReferenceExamples(itemId, aedModel);
  const [active, setActive] = useState(0);
  const [enlarged, setEnlarged] = useState<number | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  if (!examples?.length) return null;
  const multi = examples.length > 1;

  function show(index: number) {
    // Slides are exactly the scroller's width, with no gap between them.
    scroller.current?.scrollTo({ left: index * scroller.current.clientWidth, behavior: 'smooth' });
    setActive(index);
  }

  function onScroll() {
    const el = scroller.current;
    if (!el) return;
    const width = el.clientWidth || 1;
    setActive(Math.min(examples!.length - 1, Math.max(0, Math.round(el.scrollLeft / width))));
  }

  function enlarge(index: number) {
    setEnlarged(index);
    // How often the example gets enlarged per check is the clearest signal
    // of which checks still aren't self-explanatory.
    track('reference_opened', { itemId, aedModel });
  }

  const open = enlarged !== null ? examples[enlarged] : undefined;

  return (
    <div className={className}>
      {multi && (
        <div role="tablist" aria-label={m.reference.examples} className="mb-2.5 inline-flex rounded-xl bg-secondary p-0.5">
          {examples.map((ex, i) => {
            const k = KIND[ex.kind];
            const Icon = k.icon;
            const selected = active === i;
            return (
              <button
                key={`${ex.src}-${i}`}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => show(i)}
                className={cn(
                  'inline-flex h-11 items-center gap-1.5 rounded-[10px] px-3.5 text-caption font-semibold transition-colors',
                  selected ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={2.4} style={{ color: k.color }} />}
                {ex.kind === 'neutral' ? m.reference.exampleN(i + 1) : m.reference[k.label]}
              </button>
            );
          })}
        </div>
      )}

      <div
        ref={scroller}
        onScroll={multi ? onScroll : undefined}
        className={cn(multi && 'no-scrollbar flex snap-x snap-mandatory overflow-x-auto')}
      >
        {examples.map((ex, i) => (
          <figure key={`${ex.src}-${i}`} className={cn('min-w-0', multi && 'w-full shrink-0 snap-center')}>
            <ReferenceFigure example={ex} priority={i === 0} onOpen={() => enlarge(i)} />
            <figcaption className="mt-2 text-footnote leading-snug text-muted-foreground">{captionOf(ex, lang)}</figcaption>
          </figure>
        ))}
      </div>

      {open && <ReferenceLightbox example={open} onClose={() => setEnlarged(null)} />}
    </div>
  );
}
