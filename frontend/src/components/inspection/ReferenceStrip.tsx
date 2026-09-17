'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReferenceExamples } from '@/lib/reference-examples';
import type { ChecklistItemId } from '@/types';

const KIND: Record<'good' | 'bad' | 'neutral', { label: string; color: string; icon?: typeof CheckCircle2 }> = {
  good: { label: 'Correct', color: 'var(--status-good)', icon: CheckCircle2 },
  bad: { label: 'Wrong', color: 'var(--status-critical)', icon: XCircle },
  neutral: { label: 'Where to look', color: 'hsl(var(--muted-foreground))' },
};

/**
 * The reference photo, shown inline rather than hidden behind a tap.
 *
 * Someone standing in front of an AED shouldn't have to guess what we mean by
 * "the pads expiry date", open a dialog to find out, and then dismiss it
 * before they can raise the camera. Showing the target next to the button is
 * the whole instruction, delivered before the question is asked.
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
  const examples = getReferenceExamples(itemId, aedModel);

  useEffect(() => {
    if (!examples?.length) return;
    for (const ex of examples) {
      const img = new window.Image();
      img.src = ex.src;
    }
  }, [examples]);

  if (!examples?.length) return null;

  return (
    <div className={cn('grid gap-2', examples.length > 1 ? 'grid-cols-2' : 'grid-cols-1', className)}>
      {examples.map((ex) => {
        const kind = KIND[ex.kind];
        const KindIcon = kind.icon;
        return (
          <figure key={ex.src} className="min-w-0">
            <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-secondary">
              {/* unoptimized: already resized and compressed at build time, so
                  the on-demand optimiser would only add a cold-start hop. */}
              <Image
                src={ex.src}
                alt={ex.caption}
                fill
                unoptimized
                sizes="(max-width: 640px) 45vw, 260px"
                className="object-cover"
              />
              {ex.kind !== 'neutral' && (
                <span
                  className="absolute top-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-background/92 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ color: kind.color }}
                >
                  {KindIcon && <KindIcon className="w-2.5 h-2.5" strokeWidth={2.8} />}
                  {kind.label}
                </span>
              )}
            </div>
            <figcaption className="text-caption text-muted-foreground mt-1.5 leading-snug">
              {ex.caption}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
