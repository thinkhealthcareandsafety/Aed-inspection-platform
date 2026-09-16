'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { ImageIcon, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/Dialog';
import { getReferenceExamples } from '@/lib/reference-examples';
import { track } from '@/lib/track';
import type { ChecklistItemId } from '@/types';

const KIND_BADGE: Record<'good' | 'bad' | 'neutral', { label: string; className: string; icon?: typeof CheckCircle2 }> = {
  good: { label: 'Correct', className: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30', icon: CheckCircle2 },
  bad: { label: 'Needs fixing', className: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30', icon: XCircle },
  neutral: { label: 'Where to look', className: 'bg-secondary text-muted-foreground border-border' },
};

export function ReferenceExample({
  itemId,
  itemTitle,
  aedModel,
}: {
  itemId: ChecklistItemId;
  itemTitle: string;
  aedModel?: string;
}) {
  const examples = getReferenceExamples(itemId, aedModel);

  // Warm the cache as soon as the checklist renders. Without this the photo
  // is only requested when the dialog opens, so on a field connection the
  // sheet appears empty and fills in a beat later — it reads as broken.
  // These are pre-optimised files (30-70KB each), so this is cheap.
  useEffect(() => {
    if (!examples?.length) return;
    for (const ex of examples) {
      const img = new window.Image();
      img.src = ex.src;
    }
  }, [examples]);

  if (!examples?.length) return null;

  return (
    // How often the reference photo gets opened per item is the clearest
    // signal of which checks aren't self-explanatory yet.
    <Dialog onOpenChange={(open) => open && track('reference_opened', { itemId, aedModel })}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          <ImageIcon className="w-3.5 h-3.5" strokeWidth={2.25} />
          See example photo
        </button>
      </DialogTrigger>
      <DialogContent
        title={
          examples.length === 1 && examples[0].models?.length === 1
            ? `${itemTitle} — ${examples[0].models[0]}`
            : itemTitle
        }
      >
        <div className={cn('grid gap-4', examples.length > 1 ? 'sm:grid-cols-2' : 'grid-cols-1')}>
          {examples.map((ex) => {
            const badge = KIND_BADGE[ex.kind];
            const BadgeIcon = badge.icon;
            return (
              <div key={ex.src} className="flex flex-col gap-2">
                <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-border bg-secondary">
                  {/* unoptimized: these are already resized and compressed at
                      build time, so routing them through the on-demand image
                      optimiser only adds a cold-start round trip. */}
                  <Image
                    src={ex.src}
                    alt={ex.caption}
                    fill
                    unoptimized
                    sizes="(max-width: 640px) 90vw, 400px"
                    className="object-cover"
                  />
                </div>
                <div className="flex items-start gap-1.5">
                  <span
                    className={cn(
                      'inline-flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wide',
                      badge.className,
                    )}
                  >
                    {BadgeIcon && <BadgeIcon className="w-2.5 h-2.5" strokeWidth={3} />}
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{ex.caption}</p>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
