'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Loader2, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AED_MODEL_OPTIONS } from '@/lib/aed-models';
import { DEVICE_PHOTO } from '@/lib/device-photos';
import { screenTransition } from '@/lib/motion';
import { useI18n } from '@/i18n';
import { DevicePreview } from './DevicePreview';
import { UnlistedModel } from './UnlistedModel';

interface Props {
  selected: string | null;
  starting: boolean;
  /** Who is choosing — so someone with an unlisted AED can be kept as a lead. */
  contact?: { name: string; email: string; phone: string } | null;
  onSelect: (modelId: string) => void;
  onBack: () => void;
}

export function ModelSelect({ selected, starting, contact, onSelect, onBack }: Props) {
  const { m } = useI18n();
  const [previewing, setPreviewing] = useState<string | null>(null);
  return (
    <motion.div {...screenTransition} className="w-full">
      <div className="mb-6 px-1">
        <h1 className="text-display text-foreground">
          {m.model.title[0]}
          <br />
          {m.model.title[1]}
        </h1>
        <p className="text-body text-muted-foreground mt-3">{m.model.intro}</p>
      </div>

      {/* One tap starts the inspection: separate cards rather than list rows,
          because each is a whole decision and wants a thumb-sized target.
          The photo is its own button — it opens the unit large, to compare
          against the one on the wall — so the card's press is on the <li>,
          where both move together. */}
      <ul className="flex flex-col gap-2.5">
        {AED_MODEL_OPTIONS.map((model) => {
          const isSelected = selected === model.id;
          const isBusy = starting && isSelected;
          return (
            <li
              key={model.id}
              className={cn('relative', !starting && 'pressable', starting && !isSelected && 'opacity-40')}
            >
              <button
                type="button"
                disabled={starting}
                onClick={() => setPreviewing(model.id)}
                aria-label={m.model.enlarge(`${model.brand} ${model.name}`)}
                className="group absolute left-3.5 top-1/2 z-10 h-20 w-20 -translate-y-1/2 overflow-hidden rounded-2xl bg-[#f3f3f5] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:bg-white/[0.06]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={DEVICE_PHOTO[model.id]?.tile}
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-contain p-1 transition-transform duration-300 group-hover:scale-105"
                />
                <span
                  aria-hidden
                  className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-foreground/75 shadow-[0_1px_3px_rgb(0_0_0/0.18)] ring-1 ring-black/5 transition-colors group-hover:text-foreground dark:bg-neutral-800/95 dark:ring-white/10"
                >
                  <ZoomIn className="h-3.5 w-3.5" strokeWidth={2.2} />
                </span>
              </button>
              <button
                type="button"
                disabled={starting}
                onClick={() => onSelect(model.id)}
                className={cn(
                  'surface-tile w-full flex items-center gap-4 p-3.5 pr-4 text-left',
                  isSelected && '!shadow-[0_0_0_2px_hsl(var(--primary))]',
                )}
              >
                {/* Room for the photo, which sits over this spot. */}
                <span className="w-20 h-20 shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block text-caption uppercase tracking-[0.06em] text-muted-foreground">
                    {model.brand}
                  </span>
                  <span className="block text-headline text-foreground">{model.name}</span>
                  <span className="block text-footnote text-muted-foreground mt-0.5">
                    {isBusy ? m.model.settingUp : (m.model.hints[model.id] ?? model.hint)}
                  </span>
                </span>
                {isBusy ? (
                  <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
                ) : (
                  <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" strokeWidth={2} />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="text-footnote text-muted-foreground mt-3 px-1">
        {m.model.notSure}
      </p>

      {previewing && (
        <DevicePreview
          modelId={previewing}
          onModelChange={setPreviewing}
          onClose={() => setPreviewing(null)}
          onChoose={(modelId) => {
            setPreviewing(null);
            onSelect(modelId);
          }}
        />
      )}

      {contact && (
        <div className="mt-5">
          <UnlistedModel contact={contact} disabled={starting} />
        </div>
      )}

      <button
        type="button"
        onClick={onBack}
        disabled={starting}
        className="flex items-center gap-1.5 h-11 px-3 text-callout text-muted-foreground hover:text-foreground transition-colors mt-4 mx-auto disabled:opacity-50"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        {m.model.back}
      </button>
    </motion.div>
  );
}
