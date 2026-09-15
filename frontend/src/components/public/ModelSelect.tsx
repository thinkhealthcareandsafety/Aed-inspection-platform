'use client';

import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, HeartPulse, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AED_MODEL_OPTIONS } from '@/lib/aed-models';

interface Props {
  selected: string | null;
  starting: boolean;
  onSelect: (modelId: string) => void;
  onBack: () => void;
}

export function ModelSelect({ selected, starting, onSelect, onBack }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold">Select AED Model</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose the machine you&apos;re inspecting.</p>
      </div>

      <div className="glass-card p-4 space-y-2.5">
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
                'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border text-left transition-all disabled:opacity-60',
                isSelected
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border/50 bg-card/40 hover:border-primary/40 hover:bg-secondary/40',
              )}
            >
              <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-sm">{model.brand} {model.name}</div>
                <div className="text-xs text-muted-foreground">{model.id}</div>
              </div>
              {isBusy ? (
                <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              ) : isSelected ? (
                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              ) : null}
            </button>
          );
        })}

        <div className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border border-dashed border-border/40 opacity-50 cursor-not-allowed">
          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
            <HeartPulse className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-sm">Other models</div>
            <div className="text-xs text-muted-foreground">Coming soon</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onBack}
        disabled={starting}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm mt-4 mx-auto disabled:opacity-50"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>
    </motion.div>
  );
}
