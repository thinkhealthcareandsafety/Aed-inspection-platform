'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useInspectionStore } from '@/stores/inspection-store';

export function InspectionProgress() {
  const { session } = useInspectionStore();
  const progress = session?.progress ?? 0;
  const result = session?.inspectionResult;

  const barColor =
    result === 'PASS'
      ? 'bg-green-500'
      : result === 'FAIL'
        ? 'bg-red-500'
        : result === 'REVIEW'
          ? 'bg-amber-500'
          : 'bg-primary';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">Progress</span>
        <span className="text-xs font-mono text-foreground">{progress}%</span>
      </div>
      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', barColor)}
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
