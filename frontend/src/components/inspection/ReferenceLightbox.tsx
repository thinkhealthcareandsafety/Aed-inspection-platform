'use client';

import { Dialog, DialogContent } from '@/components/ui/Dialog';
import { ReferenceCloseup, ReferenceFigure, closeupZoom } from './ReferenceFigure';
import { captionOf, type ReferenceExample } from '@/lib/reference-examples';
import { useI18n } from '@/i18n';

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
  const { lang, m } = useI18n();
  const caption = captionOf(example, lang);
  const closeup = example.focus && closeupZoom(example.focus) >= 1.3 ? example.focus : undefined;

  return (
    <Dialog open onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent title={example.kind === 'bad' ? m.reference.whatAFaultLooksLike : m.reference.whatToLookFor}>
        {closeup ? (
          <>
            <ReferenceCloseup example={{ ...example, focus: closeup }} />
            <p className="mt-3 text-callout text-foreground">{caption}</p>
            <div className="mt-4">
              <ReferenceFigure example={example} size="lg" showLens={false} />
            </div>
          </>
        ) : (
          <>
            <ReferenceFigure example={example} size="lg" />
            <p className="mt-3 text-callout text-foreground">{caption}</p>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
