'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, AlertTriangle, Download, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInspectionStore } from '@/stores/inspection-store';
import { api } from '@/lib/api';
import type { InspectionResult } from '@/types';

interface ResultCardProps {
  onStartNew: () => void;
}

const RESULT_CONFIG: Record<
  InspectionResult,
  {
    icon: React.ReactNode;
    title: string;
    description: string;
    bg: string;
    border: string;
    text: string;
  }
> = {
  PASS: {
    icon: <CheckCircle2 className="w-10 h-10" />,
    title: 'Inspection Passed',
    description: 'This AED is ready for use. All checks passed.',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
    text: 'text-green-400',
  },
  FAIL: {
    icon: <XCircle className="w-10 h-10" />,
    title: 'Inspection Failed',
    description: 'This AED requires immediate attention. Do not use until serviced.',
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    text: 'text-red-400',
  },
  REVIEW: {
    icon: <AlertTriangle className="w-10 h-10" />,
    title: 'Review Required',
    description: 'Some items could not be verified. Manual review recommended.',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
  },
  INCOMPLETE: {
    icon: <AlertTriangle className="w-10 h-10" />,
    title: 'Incomplete',
    description: 'Inspection did not complete fully.',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/30',
    text: 'text-slate-400',
  },
};

export function InspectionResultCard({ onStartNew }: ResultCardProps) {
  const { inspectionId, session } = useInspectionStore();
  const result = (session?.inspectionResult ?? 'INCOMPLETE') as InspectionResult;
  const cfg = RESULT_CONFIG[result];

  const downloadPDF = () => {
    if (!inspectionId) return;
    const url = api.reports.pdf(inspectionId);
    window.open(url, '_blank');
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'rounded-xl border p-6 text-center space-y-4',
        cfg.bg,
        cfg.border,
      )}
    >
      <div className={cn('flex justify-center', cfg.text)}>{cfg.icon}</div>

      <div>
        <h3 className={cn('text-lg font-semibold', cfg.text)}>{cfg.title}</h3>
        <p className="text-sm text-muted-foreground mt-1">{cfg.description}</p>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 gap-2 text-left text-xs">
        {[
          ['Manufacturer', session?.manufacturer],
          ['Model', session?.model],
          ['Serial', session?.serialNumber],
          ['Pads Expiry', session?.padsExpiry],
          ['Battery', session?.batteryExpiry],
          ['Status', session?.statusIndicator],
        ].map(([label, val]) => (
          <div key={label} className="bg-card/50 rounded-lg p-2">
            <p className="text-muted-foreground">{label}</p>
            <p className="font-mono font-medium text-foreground truncate">{val ?? '—'}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <button
          onClick={downloadPDF}
          disabled={!inspectionId}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          <Download className="w-4 h-4" />
          Download PDF
        </button>
        <button
          onClick={onStartNew}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          New
        </button>
      </div>
    </motion.div>
  );
}
