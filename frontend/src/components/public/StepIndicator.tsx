'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

const STEPS = ['Your details', 'AED model', 'Inspect'] as const;

interface Props {
  /** 0-indexed current step */
  current: 0 | 1 | 2;
}

export function StepIndicator({ current }: Props) {
  return (
    <div className="w-full max-w-sm mx-auto px-1">
      <div className="flex items-center gap-1.5">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 h-[3px] rounded-full transition-colors',
              i <= current ? 'bg-primary' : 'bg-border',
            )}
          />
        ))}
      </div>
      <div className="flex justify-between mt-1.5">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={cn(
              'text-[11px] flex items-center gap-1',
              i === current ? 'font-semibold text-primary' : i < current ? 'font-medium text-muted-foreground' : 'text-muted-foreground/70',
            )}
          >
            {i < current && <Check className="w-2.5 h-2.5" strokeWidth={3} />}
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
