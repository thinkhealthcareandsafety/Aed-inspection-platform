'use client';

import { useState } from 'react';
import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AED_MODEL_OPTIONS } from '@/lib/aed-models';
import { DEVICE_PHOTO } from '@/lib/device-photos';
import { useI18n } from '@/i18n';

interface Props {
  modelId: string;
  onModelChange: (modelId: string) => void;
  onChoose: (modelId: string) => void;
  onClose: () => void;
}

/**
 * The unit, large — so someone standing in front of an AED can match the
 * buttons, the colour and the shape before committing to a checklist. The
 * other models sit underneath, one tap away, because the question being
 * answered is "which of these is mine?".
 */
export function DevicePreview({ modelId, onModelChange, onChoose, onClose }: Props) {
  const { m } = useI18n();
  const model = AED_MODEL_OPTIONS.find((o) => o.id === modelId) ?? AED_MODEL_OPTIONS[0];

  return (
    <RadixDialog.Root open onOpenChange={(open) => !open && onClose()}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fade-in fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-6">
          <RadixDialog.Content
            className={cn(
              'sheet-adaptive relative max-h-[94dvh] w-full max-w-md overflow-y-auto bg-card shadow-2xl focus:outline-none',
              'rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-lg sm:rounded-3xl sm:pb-5',
            )}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-border sm:hidden" aria-hidden />

            <div className="flex items-start gap-3 px-5 pt-2 sm:pt-4">
              <div className="min-w-0 flex-1 pt-1">
                <p className="text-caption uppercase tracking-[0.06em] text-muted-foreground">{model.brand}</p>
                <RadixDialog.Title className="text-headline text-foreground">{model.name}</RadixDialog.Title>
              </div>
              <RadixDialog.Close
                aria-label={m.common.close}
                className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <X className="h-5 w-5" strokeWidth={2} />
              </RadixDialog.Close>
            </div>

            <div className="px-5 pt-3">
              <Photo key={model.id} modelId={model.id} alt={`${model.brand} ${model.name}`} />
              <RadixDialog.Description className="mt-3 text-callout text-muted-foreground">
                {m.model.hints[model.id] ?? model.hint}
              </RadixDialog.Description>
            </div>

            <div className="px-5 pt-5">
              <p id="device-compare" className="text-footnote text-muted-foreground">
                {m.model.others}
              </p>
              <div role="group" aria-labelledby="device-compare" className="mt-2 grid grid-cols-3 gap-2">
                {AED_MODEL_OPTIONS.map((option) => {
                  const current = option.id === model.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={current}
                      onClick={() => onModelChange(option.id)}
                      className={cn(
                        'pressable flex flex-col items-center gap-1 rounded-2xl p-1.5 pb-2 transition-shadow',
                        current
                          ? 'shadow-[0_0_0_2px_hsl(var(--primary))]'
                          : 'shadow-[0_0_0_1px_hsl(var(--border))] hover:shadow-[0_0_0_1px_hsl(var(--foreground)/0.2)]',
                      )}
                    >
                      <span className="block h-14 w-full overflow-hidden rounded-xl bg-[#f3f3f5] dark:bg-white/[0.06]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={DEVICE_PHOTO[option.id]?.tile}
                          alt=""
                          width={56}
                          height={56}
                          className="h-full w-full object-contain p-0.5"
                        />
                      </span>
                      <span
                        className={cn(
                          'max-w-full truncate text-caption',
                          current ? 'font-semibold text-foreground' : 'text-muted-foreground',
                        )}
                      >
                        {option.name}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-5 pt-5">
              <button
                type="button"
                onClick={() => onChoose(model.id)}
                className={cn(
                  'pressable flex h-[52px] w-full items-center justify-center rounded-2xl',
                  'bg-primary text-headline text-primary-foreground transition-colors hover:bg-primary/92',
                )}
              >
                {m.model.thisIsMine}
              </button>
            </div>
          </RadixDialog.Content>
        </RadixDialog.Overlay>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

/** The tile's photo is already loaded, so it shows at once; the sharp one
 *  fades in over it, framed identically, when it arrives. */
function Photo({ modelId, alt }: { modelId: string; alt: string }) {
  const [sharp, setSharp] = useState(false);
  const photo = DEVICE_PHOTO[modelId];
  if (!photo) return null;
  return (
    <div className="relative h-[min(42dvh,22rem)] w-full overflow-hidden rounded-2xl bg-[#f3f3f5] dark:bg-white/[0.06]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.tile}
        alt=""
        aria-hidden
        // Steps aside only once the sharp photo has fully faded in over it.
        className={cn(
          'absolute inset-0 h-full w-full object-contain',
          sharp && 'opacity-0 transition-opacity delay-300 duration-0',
        )}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.large}
        alt={alt}
        width={800}
        height={800}
        decoding="async"
        onLoad={() => setSharp(true)}
        className={cn(
          'absolute inset-0 h-full w-full object-contain transition-opacity duration-300',
          sharp ? 'opacity-100' : 'opacity-0',
        )}
      />
    </div>
  );
}
