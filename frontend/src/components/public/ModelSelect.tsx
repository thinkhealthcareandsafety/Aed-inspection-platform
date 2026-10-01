'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AED_MODEL_OPTIONS } from '@/lib/aed-models';
import { screenTransition } from '@/lib/motion';
import { useI18n } from '@/i18n';
import { UnlistedModel } from './UnlistedModel';

interface Props {
  selected: string | null;
  starting: boolean;
  /** Who is choosing — so someone with an unlisted AED can be kept as a lead. */
  contact?: { name: string; email: string; phone: string } | null;
  onSelect: (modelId: string) => void;
  onBack: () => void;
}

/**
 * A photo of each unit, so the person matches the device in front of them
 * at a glance — the bright green one, the upright blue one. The studio shots
 * from buyaedindia.com, cut out and scaled to the same size so the three
 * read as one set on the same neutral tile.
 */
const DEVICE_PHOTO: Record<string, string> = {
  'Philips FRx': '/devices/frx.webp',
  'Philips HS1': '/devices/hs1.webp',
  'Zoll AED Plus': '/devices/zoll.webp',
};

export function ModelSelect({ selected, starting, contact, onSelect, onBack }: Props) {
  const { m } = useI18n();
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
          because each is a whole decision and wants a thumb-sized target. */}
      <ul className="flex flex-col gap-2.5">
        {AED_MODEL_OPTIONS.map((model) => {
          const isSelected = selected === model.id;
          const isBusy = starting && isSelected;
          return (
            <li key={model.id}>
              <button
                type="button"
                disabled={starting}
                onClick={() => onSelect(model.id)}
                className={cn(
                  'pressable surface-tile w-full flex items-center gap-4 p-3.5 pr-4 text-left',
                  isSelected && '!shadow-[0_0_0_2px_hsl(var(--primary))]',
                  starting && !isSelected && 'opacity-40',
                )}
              >
                <span className="w-20 h-20 shrink-0 overflow-hidden rounded-2xl bg-[#f3f3f5] dark:bg-white/[0.06]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={DEVICE_PHOTO[model.id]}
                    alt=""
                    width={80}
                    height={80}
                    className="h-full w-full object-contain p-1"
                  />
                </span>
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
        {m.model.editDetails}
      </button>
    </motion.div>
  );
}
