'use client';

import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { ReferenceCloseup, ReferenceFigure, closeupZoom } from './ReferenceFigure';
import type { ReferenceExample } from '@/lib/reference-examples';

/**
 * The enlarged example: the marked part filling the frame, then the whole
 * photo for context. Loaded on first tap rather than with the page — the
 * dialog machinery is most of its weight, and first load is what a phone in
 * a stairwell waits on.
 */
export default function ReferenceLightbox({
  example,
  onClose,
}: {
  example: ReferenceExample;
  onClose: () => void;
}) {
  const closeup = example.focus && closeupZoom(example.focus) >= 1.3 ? example.focus : undefined;

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent title={example.kind === 'bad' ? 'What a fault looks like' : 'What to look for'}>
        {closeup ? (
          <>
            <ReferenceCloseup example={{ ...example, focus: closeup }} />
            <p className="mt-3 text-callout text-foreground">{example.caption}</p>
            <div className="mt-4">
              <ReferenceFigure example={example} size="lg" showLens={false} />
            </div>
          </>
        ) : (
          <>
            <ReferenceFigure example={example} size="lg" />
            <p className="mt-3 text-callout text-foreground">{example.caption}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
