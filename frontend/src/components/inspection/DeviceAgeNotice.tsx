'use client';

import { motion } from 'framer-motion';
import { AlertOctagon, AlertTriangle, ReceiptText, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AgeBand, DeviceAge } from '@/lib/device-age';
import { useI18n } from '@/i18n';

/** Green inside the warranty, amber in its last year, orange past it, red
 *  past an AED's usual life. Each with its own icon, so it never rests on
 *  colour alone. */
const LOOK: Record<AgeBand, { panel: string; badge: string; title: string; icon: typeof ShieldCheck }> = {
  current: {
    panel: 'bg-emerald-500/10 ring-emerald-500/25',
    badge: 'bg-emerald-600 text-white',
    title: 'text-emerald-700 dark:text-emerald-400',
    icon: ShieldCheck,
  },
  checkInvoice: {
    panel: 'bg-amber-400/15 ring-amber-500/30',
    badge: 'bg-amber-500 text-white',
    title: 'text-amber-700 dark:text-amber-400',
    icon: ReceiptText,
  },
  replace: {
    panel: 'bg-orange-500/12 ring-orange-500/30',
    badge: 'bg-orange-500 text-white',
    title: 'text-orange-700 dark:text-orange-400',
    icon: AlertTriangle,
  },
  replaceUrgently: {
    panel: 'bg-destructive/10 ring-destructive/30',
    badge: 'bg-destructive text-destructive-foreground',
    title: 'text-destructive',
    icon: AlertOctagon,
  },
};

/**
 * What the serial label says about the AED's age and warranty, said as soon
 * as the serial is read — the age of a unit is often news to whoever is
 * holding it, and an old unit is the moment to talk about a replacement.
 */
export function DeviceAgeNotice({ age, fresh = false, className }: { age: DeviceAge; fresh?: boolean; className?: string }) {
  const { m } = useI18n();
  const look = LOOK[age.band];
  const Icon = look.icon;
  const shows = m.age.shows[age.source](age.year);
  const title = age.band === 'replace' ? m.age.title.replace(age.year, age.age) : m.age.title[age.band](age.year);
  const body =
    age.band === 'replace' || age.band === 'replaceUrgently'
      ? m.age.body[age.band](shows, age.age)
      : m.age.body[age.band](shows);

  return (
    <motion.div
      initial={fresh ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: fresh ? 0.55 : 0, duration: 0.35 }}
      className={cn('flex items-start gap-3 rounded-2xl px-4 py-3.5 ring-1 ring-inset', look.panel, className)}
      role="note"
    >
      <span className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full', look.badge)}>
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.2} />
      </span>
      <div className="min-w-0">
        <p className={cn('text-callout font-semibold', look.title)}>{title}</p>
        <p className="mt-1 text-footnote text-foreground/80">{body}</p>
      </div>
    </motion.div>
  );
}
