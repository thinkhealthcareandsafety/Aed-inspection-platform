'use client';

import { useEffect } from 'react';
import { ImageIcon } from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/Dialog';
import { getReferenceExamples } from '@/lib/reference-examples';
import { track } from '@/lib/track';
import { ReferenceFigure } from './ReferenceFigure';
import type { ChecklistItemId } from '@/types';

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
        <div className="flex flex-col gap-5">
          {examples.map((ex, i) => (
            <figure key={`${ex.src}-${i}`}>
              <ReferenceFigure example={ex} size="lg" />
              <figcaption className="mt-2 text-footnote leading-snug text-muted-foreground">{ex.caption}</figcaption>
            </figure>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
