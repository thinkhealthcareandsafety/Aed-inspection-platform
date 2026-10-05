'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, animate, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MAX_SCORE } from '@/lib/score';
import { useI18n } from '@/i18n';

/**
 * The readiness score in the top bar, live. Each check that passes adds its
 * marks while the inspector watches: the number counts up, the pill gives a
 * small bounce, and the marks just earned float up out of it ("+20"). The
 * reward lands on the thing they just did, which is what keeps a
 * ten-minute job feeling like progress.
 */
export function ScoreCounter({ score, className }: { score: number; className?: string }) {
  const { m } = useI18n();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(score);
  const [gain, setGain] = useState<{ id: number; marks: number } | null>(null);
  const previous = useRef(score);

  useEffect(() => {
    const from = previous.current;
    previous.current = score;
    if (score === from) return;
    if (score > from) setGain({ id: Date.now(), marks: score - from });
    if (reduce) {
      setShown(score);
      return;
    }
    const controls = animate(from, score, {
      duration: 0.7,
      ease: [0.32, 0.72, 0, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [score, reduce]);

  // The "+20" leaves after its float, so the next one starts fresh.
  useEffect(() => {
    if (!gain) return;
    const t = setTimeout(() => setGain(null), 1400);
    return () => clearTimeout(t);
  }, [gain]);

  return (
    <span
      className={cn('relative inline-flex shrink-0', className)}
      role="status"
      aria-live="polite"
      aria-label={m.score.aria(score, MAX_SCORE)}
    >
      <motion.span
        key={gain?.id ?? 'still'}
        initial={gain && !reduce ? { scale: 1 } : false}
        animate={gain && !reduce ? { scale: [1, 1.16, 1] } : { scale: 1 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className={cn(
          'inline-flex h-8 items-baseline gap-0.5 rounded-full px-3 pt-[5px] transition-colors duration-500',
          gain ? 'bg-emerald-500/15' : 'bg-primary/10',
        )}
      >
        <span className="text-callout font-bold tabular-nums text-foreground">{shown}</span>
        <span className="text-caption tabular-nums text-muted-foreground">/{MAX_SCORE}</span>
      </motion.span>
      <AnimatePresence>
        {gain && (
          <motion.span
            key={gain.id}
            aria-hidden
            initial={{ opacity: 0, y: 12, scale: 0.8 }}
            animate={{ opacity: [0, 1, 1, 0], y: [12, 4, 2, -4], scale: 1 }}
            transition={{ duration: 1.3, times: [0, 0.18, 0.7, 1], ease: 'easeOut' }}
            className="pointer-events-none absolute left-1/2 top-full -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-600 px-2 py-0.5 text-caption font-bold text-white shadow-md"
          >
            +{gain.marks}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
