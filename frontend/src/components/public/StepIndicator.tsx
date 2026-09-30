'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springSoft } from '@/lib/motion';
import { useI18n } from '@/i18n';

interface Props {
  /** 0-indexed current step */
  current: 0 | 1 | 2;
}

export function StepIndicator({ current }: Props) {
  const { m } = useI18n();
  const STEPS = [m.steps.details, m.steps.model, m.steps.inspect];
  return (
    <div className="w-full max-w-sm mx-auto">
      <div className="flex items-center gap-1.5">
        {STEPS.map((_, i) => (
          <div key={i} className="flex-1 h-[3px] rounded-full bg-border overflow-hidden">
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
            key={i}
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
