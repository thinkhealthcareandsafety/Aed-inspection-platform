'use client';

import { useEffect, useState } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { MAX_SCORE, READY_THRESHOLD } from '@/lib/score';
import { EASE_OUT } from '@/lib/motion';
import { useI18n } from '@/i18n';

const SIZE = 148;
const STROKE = 11;
const R = (SIZE - STROKE) / 2;
const C = 2 * Math.PI * R;

/**
 * The final score, counted up as the ring fills — the payoff of the whole
 * inspection. A notch marks the pass line at 80, so where the ring stops
 * against it says the verdict before the words do.
 */
export function ScoreRing({ score, tone }: { score: number; tone: 'ok' | 'bad' | 'warn' | 'neutral' }) {
  const { m } = useI18n();
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? score : 0);

  useEffect(() => {
    if (reduce) {
      setShown(score);
      return;
    }
    const controls = animate(0, score, {
      duration: 1.4,
      delay: 0.25,
      ease: EASE_OUT,
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [score, reduce]);

  const colour = {
    ok: 'text-emerald-500',
    bad: 'text-destructive',
    warn: 'text-amber-500',
    neutral: 'text-muted-foreground',
  }[tone];
  // The pass line, as an angle from the top of the ring.
  const notch = (READY_THRESHOLD / MAX_SCORE) * 360;

  return (
    <div
      className="relative mx-auto"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={m.score.aria(score, MAX_SCORE)}
    >
      {tone === 'ok' && !reduce && (
        <motion.span
          aria-hidden
          className="absolute inset-0 rounded-full bg-emerald-500"
          initial={{ scale: 0.85, opacity: 0.3 }}
          animate={{ scale: 1.35, opacity: 0 }}
          transition={{ duration: 1.2, ease: EASE_OUT, delay: 1.5 }}
        />
      )}
      <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="relative -rotate-90" aria-hidden>
        <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-border" />
        <motion.circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          fill="none"
          strokeWidth={STROKE}
          strokeLinecap="round"
          stroke="currentColor"
          className={colour}
          strokeDasharray={C}
          initial={{ strokeDashoffset: reduce ? C * (1 - score / MAX_SCORE) : C }}
          animate={{ strokeDashoffset: C * (1 - score / MAX_SCORE) }}
          transition={{ duration: 1.4, delay: 0.25, ease: EASE_OUT }}
        />
      </svg>
      {/* The pass line at 80. */}
      <span
        aria-hidden
        className="absolute left-1/2 top-0 h-1/2 w-0 origin-bottom"
        style={{ transform: `translateX(-50%) rotate(${notch}deg)` }}
      >
        <span
          className="absolute -left-[2px] h-[17px] w-[4px] rounded-full bg-foreground/55"
          style={{ top: -3 }}
        />
      </span>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[44px] font-bold leading-none tracking-tight tabular-nums text-foreground">{shown}</span>
        <span className={cn('mt-1 text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground')}>
          / {MAX_SCORE}
        </span>
      </div>
    </div>
  );
}
