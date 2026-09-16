'use client';

import { motion } from 'framer-motion';
import { TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springSoft } from '@/lib/motion';
import type { FunnelStepRow } from '@/types/insights';

/**
 * The funnel, read top to bottom.
 *
 * One series, so one colour and no legend — the bar length carries the
 * magnitude and every value is directly labelled. What the chart is actually
 * for is the gap *between* bars, so each loss is spelled out on its own line
 * rather than left to be eyeballed, and the costliest one is called out by
 * icon and words, not colour alone.
 */
export function FunnelChart({
  steps,
  biggestDropIndex,
}: {
  steps: FunnelStepRow[];
  biggestDropIndex: number;
}) {
  const top = steps[0]?.sessions ?? 0;

  return (
    <div className="surface-group p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-headline text-foreground">Where people drop off</h2>
        <span className="text-caption text-muted-foreground tabular-nums">
          {top.toLocaleString('en-IN')} visits
        </span>
      </div>

      <ol className="mt-5">
        {steps.map((step, i) => {
          const isWorst = i === biggestDropIndex;
          return (
            <li key={step.key}>
              {/* The loss that happened on the way into this step. */}
              {i > 0 && (
                <div className="flex items-center gap-2 py-2 pl-[3px]">
                  <span className="w-px h-6 bg-border shrink-0" aria-hidden="true" />
                  {step.lost > 0 ? (
                    <span
                      className={cn(
                        'inline-flex items-center gap-1.5 text-caption',
                        isWorst ? 'font-medium' : 'text-muted-foreground',
                      )}
                      style={isWorst ? { color: 'var(--status-critical)' } : undefined}
                    >
                      {isWorst && <TrendingDown className="w-3.5 h-3.5" strokeWidth={2.2} />}
                      {step.lost.toLocaleString('en-IN')} left here
                      <span className="opacity-70">({(100 - step.fromPrev).toFixed(0)}%)</span>
                      {isWorst && <span className="opacity-70">· biggest loss</span>}
                    </span>
                  ) : (
                    <span className="text-caption text-muted-foreground">Everyone continued</span>
                  )}
                </div>
              )}

              <div className="group relative">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-callout text-foreground truncate">{step.label}</span>
                  <span className="text-callout font-mono tabular-nums text-foreground shrink-0">
                    {step.sessions.toLocaleString('en-IN')}
                    <span className="text-muted-foreground ml-2">{step.fromTop.toFixed(0)}%</span>
                  </span>
                </div>

                <div className="mt-1.5 h-2 rounded-[3px] bg-secondary overflow-hidden">
                  <motion.div
                    className="h-full rounded-r-[3px] bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(step.fromTop, step.sessions > 0 ? 1.5 : 0)}%` }}
                    transition={{ ...springSoft, delay: i * 0.04 }}
                  />
                </div>

                {/* Hover detail — the absolute numbers behind the percentage. */}
                <div
                  role="tooltip"
                  className="pointer-events-none absolute right-0 -top-1 translate-y-[-100%] z-10 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg bg-foreground text-background px-2.5 py-1.5 text-caption whitespace-nowrap shadow-lg"
                >
                  {step.sessions.toLocaleString('en-IN')} of {top.toLocaleString('en-IN')} ·{' '}
                  {step.fromPrev.toFixed(0)}% of the previous step
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
