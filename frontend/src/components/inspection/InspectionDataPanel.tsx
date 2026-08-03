'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useInspectionStore } from '@/stores/inspection-store';

interface DataRowProps {
  label: string;
  value: string | undefined | null;
  mono?: boolean;
  highlight?: 'pass' | 'fail' | 'warn';
}

function DataRow({ label, value, mono, highlight }: DataRowProps) {
  return (
    <div className="flex items-center justify-between gap-2 py-2 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <AnimatePresence mode="wait">
        {value ? (
          <motion.span
            key={value}
            initial={{ opacity: 0, x: 4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'text-xs font-medium truncate max-w-[60%] text-right',
              mono && 'font-mono',
              highlight === 'pass' && 'text-green-600 dark:text-green-400',
              highlight === 'fail' && 'text-red-600 dark:text-red-400',
              highlight === 'warn' && 'text-amber-600 dark:text-amber-400',
              !highlight && 'text-foreground',
            )}
          >
            {value}
          </motion.span>
        ) : (
          <motion.span
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-muted-foreground/40 italic"
          >
            —
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function statusHighlight(status?: string): 'pass' | 'fail' | 'warn' | undefined {
  if (!status) return undefined;
  if (status === 'healthy' || status === 'ready') return 'pass';
  if (status === 'fault') return 'fail';
  return 'warn';
}

function resultHighlight(result?: string): 'pass' | 'fail' | 'warn' | undefined {
  if (result === 'PASS') return 'pass';
  if (result === 'FAIL') return 'fail';
  if (result === 'REVIEW') return 'warn';
  return undefined;
}

export function InspectionDataPanel() {
  const { session } = useInspectionStore();

  return (
    <div className="glass-card p-4">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">
        Captured Data
      </p>

      <DataRow label="Manufacturer" value={session?.manufacturer} />
      <DataRow label="Model" value={session?.model} />
      <DataRow label="Serial Number" value={session?.serialNumber} mono />
      <DataRow label="Pads Expiry" value={session?.padsExpiry} mono />
      <DataRow label="Battery Expiry" value={session?.batteryExpiry} mono />
      <DataRow
        label="AED Status"
        value={session?.statusIndicator}
        highlight={statusHighlight(session?.statusIndicator)}
      />
      <DataRow
        label="Result"
        value={session?.inspectionResult}
        highlight={resultHighlight(session?.inspectionResult)}
      />
    </div>
  );
}
