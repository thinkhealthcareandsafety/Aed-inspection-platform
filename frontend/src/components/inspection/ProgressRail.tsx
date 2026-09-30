'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springSoft } from '@/lib/motion';
import { useI18n } from '@/i18n';
import type { ChecklistItemMeta } from '@/lib/checklist-config';
import type { ChecklistItemResult } from '@/types';

/**
 * One segment per required check, coloured by how it went. Replaces a plain
 * percentage bar: "4 of 6" says how far along someone is, but only the
 * segments say *which* one failed, and that the one in progress is next.
 */
export function ProgressRail({
  items,
  checklist,
  activeId,
  className,
}: {
  items: ChecklistItemMeta[];
  checklist: ChecklistItemResult[];
  activeId: string | null;
  className?: string;
}) {
  const { m } = useI18n();
  const statusOf = (id: string) => checklist.find((c) => c.itemId === id)?.status;
  const done = items.filter((i) => statusOf(i.id) === 'pass' || statusOf(i.id) === 'fail').length;

  return (
    <div
      className={cn('flex items-center gap-1', className)}
      role="progressbar"
      aria-label={m.inspection.requiredDone}
      aria-valuemin={0}
      aria-valuemax={items.length}
      aria-valuenow={done}
    >
      {items.map((item) => {
        const status = statusOf(item.id);
        const active = item.id === activeId;
        const resolved = status === 'pass' || status === 'fail';
        return (
          <span key={item.id} className="relative flex-1 h-1 rounded-full bg-border overflow-hidden">
            <motion.span
              className={cn(
                'absolute inset-0 rounded-full origin-left',
                status === 'pass'
                  ? 'bg-emerald-500'
                  : status === 'fail' || status === 'error'
                    ? 'bg-destructive'
                    : 'bg-primary',
                active && status === 'analyzing' && 'animate-pulse',
              )}
              initial={false}
              animate={{ scaleX: resolved || status === 'error' ? 1 : active ? 0.4 : 0 }}
              transition={springSoft}
            />
          </span>
        );
      })}
    </div>
  );
}
