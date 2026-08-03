'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInspectionStore } from '@/stores/inspection-store';
import { STEP_META, type InspectionSession, type InspectionStep } from '@/types';

const STEPS: InspectionStep[] = [
  'wait_for_machine',
  'identify_machine',
  'serial_number',
  'pads_expiry',
  'battery_check',
  'status_check',
  'report',
  'complete',
];

export function InspectionTimeline() {
  const { session, completedSteps } = useInspectionStore();
  const currentStep = session?.step ?? 'wait_for_machine';
  const currentIdx = STEPS.indexOf(currentStep);

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
        Inspection Steps
      </p>

      {STEPS.map((step, idx) => {
        const meta = STEP_META[step];
        const isCompleted = completedSteps.includes(step);
        const isCurrent = step === currentStep;
        const isPending = idx > currentIdx && !isCompleted;

        return (
          <motion.div
            key={step}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04 }}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200',
              isCurrent && 'bg-primary/10 border border-primary/20',
              isCompleted && !isCurrent && 'opacity-60',
              isPending && 'opacity-35',
            )}
          >
            {/* Step icon / state indicator */}
            <div className="shrink-0">
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : isCurrent ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin" />
              ) : (
                <Circle className="w-4 h-4 text-muted-foreground/40" />
              )}
            </div>

            {/* Step info */}
            <div className="flex-1 min-w-0">
              <p
                className={cn(
                  'text-sm font-medium truncate',
                  isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                {meta.icon} {meta.label}
              </p>

              {/* Show captured data inline */}
              {isCompleted && _getStepData(step, session) && (
                <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                  {_getStepData(step, session)}
                </p>
              )}
            </div>

            {/* Step number */}
            <span className="text-xs text-muted-foreground/40 font-mono shrink-0">
              {String(idx + 1).padStart(2, '0')}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}

function _getStepData(
  step: InspectionStep,
  session: InspectionSession | null,
): string | null {
  if (!session) return null;
  switch (step) {
    case 'identify_machine':
      return session.manufacturer
        ? `${session.manufacturer} ${session.model ?? ''}`
        : null;
    case 'serial_number':
      return session.serialNumber ?? null;
    case 'pads_expiry':
      return session.padsExpiry ?? null;
    case 'battery_check':
      return session.batteryExpiry ?? null;
    case 'status_check':
      return session.statusIndicator ?? null;
    default:
      return null;
  }
}
