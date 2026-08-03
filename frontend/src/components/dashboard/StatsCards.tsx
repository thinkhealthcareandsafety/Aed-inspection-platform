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
      icon: <Activity className="w-5 h-5" />,
      color: 'text-primary',
      bg: 'bg-primary/10 border-primary/20',
      delay: 0,
    },
    {
      label: 'Pass Rate',
      value: data ? `${data.passRate}%` : '—',
      icon: <TrendingUp className="w-5 h-5" />,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
      delay: 0.05,
    },
    {
      label: 'Passed',
      value: data?.passed ?? 0,
      icon: <CheckCircle2 className="w-5 h-5" />,
      color: 'text-green-400',
      bg: 'bg-green-500/10 border-green-500/20',
      delay: 0.1,
    },
    {
      label: 'Failed',
      value: data?.failed ?? 0,
      icon: <XCircle className="w-5 h-5" />,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      delay: 0.15,
    },
    {
      label: 'Review Required',
      value: data?.review ?? 0,
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      delay: 0.2,
    },
    {
      label: 'Last 30 Days',
      value: data?.recent ?? 0,
      icon: <Clock className="w-5 h-5" />,
      color: 'text-sky-400',
      bg: 'bg-sky-500/10 border-sky-500/20',
      delay: 0.25,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {cards.map((card) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: card.delay, duration: 0.3 }}
          className={cn(
            'rounded-xl border p-4 glass-card',
            card.bg,
          )}
        >
          <div className={cn('mb-2', card.color)}>{card.icon}</div>
          <div className={cn('text-2xl font-bold font-mono', card.color)}>
            {isLoading ? (
              <span className="w-8 h-6 bg-muted/40 rounded animate-pulse block" />
            ) : (
              card.value
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
        </motion.div>
      ))}
    </div>
  );
}
