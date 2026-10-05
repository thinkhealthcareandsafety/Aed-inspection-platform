'use client';

import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springSnappy } from '@/lib/motion';
import type { DeviceAge } from '@/lib/device-age';
import { useI18n } from '@/i18n';

interface Props {
  /** The readiness indicator showed ready. */
  ready: boolean;
  serial: string | null;
  age: DeviceAge | null;
  /** Checks left in the full inspection. */
  remaining: number;
  finishing: boolean;
  onFinish: () => void;
  onContinue: () => void;
}

const AGE_TONE = {
  current: 'text-emerald-700 dark:text-emerald-400',
  checkInvoice: 'text-amber-700 dark:text-amber-400',
  replace: 'text-orange-700 dark:text-orange-400',
  replaceUrgently: 'text-destructive',
} as const;

/**
 * The fork after the quick check. Most people checking an AED want one
 * answer — will it work right now — and the readiness indicator is it. So
 * when the unit shows ready, finishing here is the main action and the full
 * inspection is offered beside it. When it doesn't, the order flips: a
 * not-ready AED needs its cause found, and the full inspection is how.
 */
export function QuickCheckpoint({ ready, serial, age, remaining, finishing, onFinish, onContinue }: Props) {
  const { m } = useI18n();
  const t = m.quick;
  const copy = ready ? t.ready : t.notReady;

  const finishButton = (primary: boolean) => (
    <button
      key="finish"
      type="button"
      onClick={onFinish}
      disabled={finishing}
      className={cn(
        'pressable flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-headline transition-colors disabled:opacity-60',
        primary
          ? 'bg-primary text-primary-foreground shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.7)] hover:bg-primary/92'
          : 'bg-secondary text-foreground hover:bg-secondary/75',
      )}
    >
      {finishing && <Loader2 className="h-4 w-4 animate-spin" />}
      {copy.finish}
    </button>
  );
  const continueButton = (primary: boolean) => (
    <button
      key="continue"
      type="button"
      onClick={onContinue}
      disabled={finishing}
      className={cn(
        'pressable flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl text-headline transition-colors disabled:opacity-60',
        primary
          ? 'bg-primary text-primary-foreground shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.7)] hover:bg-primary/92'
          : 'bg-secondary text-foreground hover:bg-secondary/75',
      )}
    >
      {copy.full}
      <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.2} />
    </button>
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSnappy}
      className="surface-card px-5 pt-6 pb-5"
      aria-labelledby="quick-checkpoint"
    >
      <div className="text-center">
        <span
          className={cn(
            'mx-auto flex h-14 w-14 items-center justify-center rounded-full text-white',
            ready ? 'bg-emerald-600' : 'bg-destructive',
          )}
        >
          {ready ? <Check className="h-7 w-7" strokeWidth={3} /> : <AlertTriangle className="h-7 w-7" strokeWidth={2.2} />}
        </span>
        <p
          className={cn(
            'mt-4 text-caption font-semibold uppercase tracking-[0.08em]',
            ready ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
          )}
        >
          {t.eyebrow}
        </p>
        <h2 id="quick-checkpoint" className="mt-1 text-title text-foreground">
          {copy.title}
        </h2>
        <p className="mt-1.5 text-body text-muted-foreground">{copy.body}</p>
      </div>

      {/* What the quick check found, in two lines. */}
      <dl className="surface-group mt-5 text-left">
        <div className="surface-row flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-callout text-muted-foreground">{t.readiness}</dt>
          <dd
            className={cn(
              'text-callout font-semibold',
              ready ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
            )}
          >
            {ready ? t.isReady : t.notReadyShort}
          </dd>
        </div>
        <div className="surface-row flex items-center justify-between gap-3 px-4 py-3">
          <dt className="text-callout text-muted-foreground">{t.serial}</dt>
          <dd className="min-w-0 text-right">
            <span className={cn('block truncate text-callout font-semibold text-foreground', serial && 'font-mono')}>
              {serial ?? t.notRead}
            </span>
            {age && (
              <span className={cn('block text-caption font-medium', AGE_TONE[age.band])}>
                {age.band === 'replace' ? m.age.title.replace(age.year, age.age) : m.age.title[age.band](age.year)}
              </span>
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-col gap-2.5">
        {ready ? [finishButton(true), continueButton(false)] : [continueButton(true), finishButton(false)]}
      </div>
      <p className="mt-2.5 text-center text-footnote text-muted-foreground">{t.fullDetail(remaining)}</p>
    </motion.section>
  );
}
