'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springSoft } from '@/lib/motion';

const STEPS = ['Details', 'Model', 'Inspect'] as const;

interface Props {
  /** 0-indexed current step */
  current: 0 | 1 | 2;
}

export function StepIndicator({ current }: Props) {
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex items-center gap-1.5">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 h-[3px] rounded-full bg-border overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-foreground"
              initial={false}
              animate={{ scaleX: i <= current ? 1 : 0 }}
              style={{ originX: 0 }}
              transition={springSoft}
            />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-2">
        {STEPS.map((label, i) => (
          <span
            key={label}
            className={cn(
              'text-caption transition-colors',
              i === current ? 'text-foreground' : 'text-muted-foreground/60',
            )}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}
