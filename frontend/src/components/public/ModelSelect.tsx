'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AED_MODEL_OPTIONS, COMING_SOON_MODELS } from '@/lib/aed-models';
import { screenTransition } from '@/lib/motion';
import { AedGlyph } from './AedGlyph';

interface Props {
  selected: string | null;
  starting: boolean;
  onSelect: (modelId: string) => void;
  onBack: () => void;
}

/**
 * Each unit's body colour behind its silhouette, so the tile looks like the
 * thing in front of the person: spotting "the bright green one" is faster
 * than reading "AED Plus". Fixed hues, lifted for the dark theme.
 */
const DEVICE_TONE: Record<string, string> = {
  'Philips FRx': 'text-[#48617f] bg-[#48617f]/10 dark:text-[#a9bdd6] dark:bg-[#a9bdd6]/10',
  'Philips HS1': 'text-[#1d56a0] bg-[#1d56a0]/10 dark:text-[#8db6ee] dark:bg-[#8db6ee]/10',
  'Zoll AED Plus': 'text-[#447f17] bg-[#76b82a]/15 dark:text-[#a6d96a] dark:bg-[#a6d96a]/10',
};

export function ModelSelect({ selected, starting, onSelect, onBack }: Props) {
  return (
    <motion.div {...screenTransition} className="w-full">
      <div className="mb-6 px-1">
        <h1 className="text-display text-foreground">
          Which AED are<br />you inspecting?
        </h1>
        <p className="text-body text-muted-foreground mt-3">
          Your checks and example photos are matched to this exact model.
        </p>
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
                <span
                  className={cn(
                    'w-14 h-14 rounded-xl flex items-center justify-center shrink-0',
                    DEVICE_TONE[model.id] ?? 'text-muted-foreground bg-secondary',
                  )}
                >
                  <AedGlyph model={model.id} className="w-9 h-9" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-caption uppercase tracking-[0.06em] text-muted-foreground">
                    {model.brand}
                  </span>
                  <span className="block text-headline text-foreground">{model.name}</span>
                  <span className="block text-footnote text-muted-foreground mt-0.5">
                    {isBusy ? 'Setting up your checklist…' : model.hint}
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

      <p className="text-footnote text-muted-foreground mt-4 px-1">
        Not sure? The model name is printed on the front of the unit and on the label at the back.
      </p>
      <p className="text-footnote text-muted-foreground/70 mt-1.5 px-1">
        Coming soon: {COMING_SOON_MODELS.join(', ')}.
      </p>

      <button
        type="button"
        onClick={onBack}
        disabled={starting}
        className="flex items-center gap-1.5 h-11 px-3 text-callout text-muted-foreground hover:text-foreground transition-colors mt-4 mx-auto disabled:opacity-50"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Edit my details
      </button>
    </motion.div>
  );
}
