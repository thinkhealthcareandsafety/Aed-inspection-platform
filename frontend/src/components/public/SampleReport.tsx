'use client';

import { useRef, useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { ArrowRight, FileText, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { SAMPLE_PAGES, SAMPLE_PDF } from '@/lib/sample-report';
import { useBackToClose } from '@/lib/use-back-to-close';

const PAGE_RATIO = '1241 / 1754';

function Page({ src, alt, eager }: { src: string; alt: string; eager: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <div
      className={cn(
        'relative w-full overflow-hidden rounded-lg bg-white shadow-[0_1px_2px_rgb(0_0_0/0.06),0_10px_30px_-12px_rgb(0_0_0/0.28)] ring-1 ring-black/5',
        !loaded && 'animate-pulse',
      )}
      style={{ aspectRatio: PAGE_RATIO }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={1241}
        height={1754}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn('h-full w-full transition-opacity duration-300', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  );
}

/**
 * The report, shown before anyone is asked for anything. A stranger deciding
 * whether to type in their mobile number wants to know what they get for it;
 * this is the answer, as paper, with the way in right underneath.
 *
 * Loaded on first tap — none of it is on the landing page's critical path.
 */
export default function SampleReport({ onClose, onStart }: { onClose: () => void; onStart: () => void }) {
  const { m } = useI18n();
  const t = m.sample;
  const starting = useRef(false);
  useBackToClose(onClose);

  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        {/* The overlay is the positioning frame, so a tap on the dimmed
            area around the sheet closes it. */}
        <RadixDialog.Overlay className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-6">
          <RadixDialog.Content
            onCloseAutoFocus={(e) => {
              // Starting hands focus to the form, not back to the tile.
              if (starting.current) e.preventDefault();
            }}
            className={cn(
              'sheet-adaptive relative flex w-full max-w-md flex-col overflow-hidden bg-card shadow-2xl focus:outline-none',
              'h-[92dvh] rounded-t-3xl sm:h-[88vh] sm:max-w-xl sm:rounded-3xl',
            )}
          >
            <div className="shrink-0 border-b border-border/70 px-5 pb-3.5 pt-2.5">
              <div className="mx-auto mb-2.5 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1 pt-1">
                  <RadixDialog.Title className="text-headline text-foreground">{t.title}</RadixDialog.Title>
                  <RadixDialog.Description className="mt-0.5 text-footnote text-muted-foreground">
                    {t.intro}
                  </RadixDialog.Description>
                </div>
                <RadixDialog.Close
                  aria-label={m.common.close}
                  className="tap-target -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="h-5 w-5" strokeWidth={2} />
                </RadixDialog.Close>
              </div>
            </div>

            {/* Paper on a soft ground, so the white pages read as pages in
                either theme. */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-secondary/70 px-4 py-5 sm:px-8">
              <div className="mx-auto flex max-w-[480px] flex-col gap-4">
                {SAMPLE_PAGES.map((src, i) => (
                  <Page key={src} src={src} alt={t.pageAlt(i + 1, SAMPLE_PAGES.length)} eager={i === 0} />
                ))}
              </div>
            </div>

            <div className="shrink-0 border-t border-border/70 bg-card px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
              <div className="flex items-center gap-2">
                <a
                  href={SAMPLE_PDF}
                  target="_blank"
                  rel="noopener"
                  className="pressable flex h-[52px] shrink-0 items-center justify-center gap-1.5 rounded-2xl bg-secondary px-4 text-callout font-medium text-foreground transition-colors hover:bg-secondary/75"
                >
                  <FileText className="h-4 w-4" strokeWidth={2} />
                  {t.open}
                </a>
                <button
                  type="button"
                  onClick={() => {
                    starting.current = true;
                    onStart();
                  }}
                  className="pressable flex h-[52px] min-w-0 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 text-headline text-primary-foreground transition-colors hover:bg-primary/92"
                >
                  <span className="truncate">{t.start}</span>
                  <ArrowRight className="h-[18px] w-[18px] shrink-0" strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}
