'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  CheckCircle2, XCircle, AlertTriangle, Activity,
  TrendingUp, Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';

export function StatsCards() {
  const { data, isLoading } = useQuery({
    queryKey: ['inspection-stats'],
    queryFn: () => api.inspections.stats().then((r) => r.data),
  });

  const cards = [
    {
      label: 'Total Inspections',
      value: data?.total ?? 0,
      icon: <Activity className="w-[15px] h-[15px]" strokeWidth={2} />,
      tile: 'bg-primary',
      textColor: '',
      delay: 0,
    },
    {
      label: 'Pass Rate',
      value: data ? `${data.passRate}%` : '—',
      icon: <TrendingUp className="w-[15px] h-[15px]" strokeWidth={2} />,
      tile: 'bg-emerald-600',
      textColor: 'text-emerald-700 dark:text-emerald-400',
      delay: 0.05,
    },
    {
      label: 'Passed',
      value: data?.passed ?? 0,
      icon: <CheckCircle2 className="w-[15px] h-[15px]" strokeWidth={2} />,
      tile: 'bg-emerald-600',
      textColor: '',
      delay: 0.1,
    },
    {
      label: 'Failed',
      value: data?.failed ?? 0,
      icon: <XCircle className="w-[15px] h-[15px]" strokeWidth={2} />,
      tile: 'bg-destructive',
      textColor: '',
      delay: 0.15,
    },
    {
      label: 'Review Required',
      value: data?.review ?? 0,
      icon: <AlertTriangle className="w-[15px] h-[15px]" strokeWidth={2} />,
      tile: 'bg-amber-600',
      textColor: '',
      delay: 0.2,
    },
    {
      label: 'Last 30 Days',
      value: data?.recent ?? 0,
      icon: <Clock className="w-[15px] h-[15px]" strokeWidth={2} />,
      // Fixed neutral (not a theme token) so the white icon stays visible in
      // both themes — bg-foreground flips to near-white in dark mode and
      // swallows it.
      tile: 'bg-slate-700',
      textColor: '',
      delay: 0.25,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {cards.map((card) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: card.delay, duration: 0.3 }}
          className="rounded-2xl border border-border bg-card p-4"
        >
          <div className={cn('w-[30px] h-[30px] rounded-lg flex items-center justify-center text-white mb-3', card.tile)}>
            {card.icon}
          </div>
          <div className={cn('text-[22px] font-bold font-mono tracking-tight leading-none', card.textColor)}>
            {isLoading ? (
              <span className="w-8 h-6 bg-muted/40 rounded animate-pulse block" />
            ) : (
              card.value
            )}
          </div>
          <p className="text-[11.5px] text-muted-foreground mt-2">{card.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
