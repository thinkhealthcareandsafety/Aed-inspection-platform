'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, Check, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AED_MODEL_OPTIONS } from '@/lib/aed-models';
import { screenTransition } from '@/lib/motion';

interface Props {
  selected: string | null;
  starting: boolean;
  onSelect: (modelId: string) => void;
  onBack: () => void;
}

export function ModelSelect({ selected, starting, onSelect, onBack }: Props) {
  return (
    <motion.div
      {...screenTransition}
      className="w-full max-w-sm mx-auto"
    >
      <div className="mb-7 px-1">
        <h1 className="text-display text-foreground">
          Which AED are<br />you inspecting?
        </h1>
        <p className="text-body text-muted-foreground mt-3">
          We tailor the checks and the reference photos to your exact machine.
        </p>
      </div>

      <div className="surface-group">
        {AED_MODEL_OPTIONS.map((model) => {
          const isSelected = selected === model.id;
          const isBusy = starting && isSelected;
          return (
            <button
              key={model.id}
              type="button"
              disabled={starting}
              onClick={() => onSelect(model.id)}
              className={cn(
                'surface-row w-full flex items-center gap-3 px-4 py-4 text-left',
                'transition-colors hover:bg-secondary/50 active:bg-secondary disabled:opacity-60',
                isSelected && 'bg-secondary/60',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="text-headline text-foreground">
                  {model.brand} {model.name}
                </div>
              </div>
              {isBusy ? (
                <Loader2 className="w-[18px] h-[18px] text-muted-foreground animate-spin shrink-0" />
              ) : isSelected ? (
                <Check className="w-[18px] h-[18px] text-primary shrink-0" strokeWidth={2.5} />
              ) : (
                <ChevronRight className="w-[18px] h-[18px] text-muted-foreground/40 shrink-0" strokeWidth={2} />
              )}
            </button>
          );
        })}

        <div className="surface-row flex items-center gap-3 px-4 py-4 opacity-45">
          <div className="min-w-0 flex-1">
            <div className="text-headline text-foreground">Other models</div>
            <div className="text-footnote text-muted-foreground mt-0.5">Coming soon</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        disabled={starting}
        className="flex items-center gap-1.5 text-callout text-muted-foreground hover:text-foreground transition-colors mt-6 mx-auto disabled:opacity-50"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={2} />
        Back
      </button>
    </motion.div>
  );
}
