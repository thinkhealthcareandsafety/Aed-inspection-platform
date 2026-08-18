'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, PlayCircle, CheckCircle2, Download, RotateCcw } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CHECKLIST_SECTIONS, REQUIRED_ITEM_IDS } from '@/lib/checklist-config';
import { ChecklistItemCard } from '@/components/inspection/ChecklistItemCard';
import type { ChecklistItemResult, Inspection, InspectionResult } from '@/types';

const RESULT_STYLES: Record<InspectionResult, { label: string; className: string }> = {
  PASS: { label: 'PASS', className: 'text-emerald-500 border-emerald-500/40 bg-emerald-500/10' },
  FAIL: { label: 'FAIL', className: 'text-destructive border-destructive/40 bg-destructive/10' },
  REVIEW: { label: 'NEEDS REVIEW', className: 'text-amber-500 border-amber-500/40 bg-amber-500/10' },
  INCOMPLETE: { label: 'INCOMPLETE', className: 'text-muted-foreground border-border/40 bg-secondary/40' },
};

export default function InspectionPage() {
  const { user } = useAuthStore();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);

  const requiredResolvedCount = useMemo(() => {
    if (!inspection) return 0;
    return inspection.checklist.filter(
      (c) => REQUIRED_ITEM_IDS.includes(c.itemId) && (c.status === 'pass' || c.status === 'fail'),
    ).length;
  }, [inspection]);

  const allRequiredResolved = requiredResolvedCount === REQUIRED_ITEM_IDS.length;
  const progressPct = Math.round((requiredResolvedCount / REQUIRED_ITEM_IDS.length) * 100);
  const isComplete = inspection?.inspectionStatus === 'complete';

  const handleStart = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to start an inspection');
      return;
    }
    setStarting(true);
    try {
      const res = await api.inspections.create({});
      setInspection(res.data.inspection);
    } catch {
      toast.error('Could not start inspection');
    } finally {
      setStarting(false);
    }
  }, [user]);

  const handleItemChange = useCallback((result: ChecklistItemResult) => {
    setInspection((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        checklist: prev.checklist.map((c) => (c.itemId === result.itemId ? result : c)),
      };
    });
  }, []);

  const handleComplete = useCallback(async () => {
    if (!inspection) return;
    setCompleting(true);
    try {
      const res = await api.inspections.complete(inspection.inspectionId);
      setInspection(res.data.inspection);
    } catch {
      toast.error('Could not finalize inspection');
    } finally {
      setCompleting(false);
    }
  }, [inspection]);

  const handleReset = useCallback(() => setInspection(null), []);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium">AED Inspection Checklist</span>
        </div>
        <div className="text-xs text-muted-foreground">{user?.name ?? 'Inspector'}</div>
      </header>

      <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 flex flex-col gap-6">
        {!inspection && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center py-20">
            <h1 className="text-2xl font-semibold">Philips FRx / HS1 Inspection</h1>
            <p className="text-muted-foreground max-w-md text-sm">
              10 checks across 3 sections. Capture or upload a photo (or short video) for each item —
              Gemini analyses it instantly.
            </p>
            <button
              onClick={handleStart}
              disabled={starting}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-lg shadow-primary/25 transition-all disabled:opacity-60"
            >
              <PlayCircle className="w-5 h-5" />
              {starting ? 'Starting…' : 'Start Inspection'}
            </button>
          </div>
        )}

        {inspection && (
          <>
            {/* Progress */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="font-medium">Required items</span>
                <span className="text-muted-foreground">
                  {requiredResolvedCount}/{REQUIRED_ITEM_IDS.length}
                </span>
              </div>
              <div className="h-2 rounded-full bg-secondary/50 overflow-hidden">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={{ ease: 'easeOut' }}
                />
              </div>
            </div>

            <AnimatePresence>
              {isComplete && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={cn('glass-card p-5 border flex items-center justify-between gap-4', RESULT_STYLES[inspection.inspectionResult].className)}
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-6 h-6" />
                    <div>
                      <div className="font-bold text-lg">{RESULT_STYLES[inspection.inspectionResult].label}</div>
                      <div className="text-xs opacity-80">Inspection complete</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => api.reports.downloadPdf(inspection.inspectionId)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary/60 hover:bg-secondary text-xs font-medium transition-colors"
                    >
                      <Download className="w-3.5 h-3.5" />
                      PDF
                    </button>
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-secondary/60 hover:bg-secondary text-xs font-medium transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      New
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sections */}
            {CHECKLIST_SECTIONS.map((section) => (
              <div key={section.section} className="flex flex-col gap-3">
                <div>
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/15 text-primary text-xs flex items-center justify-center font-bold">
                      {section.section}
                    </span>
                    {section.title}
                  </h2>
                  <p className="text-xs text-muted-foreground ml-7">{section.subtitle}</p>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  {section.items.map((item) => {
                    const result = inspection.checklist.find((c) => c.itemId === item.id);
                    if (!result) return null;
                    return (
                      <ChecklistItemCard
                        key={item.id}
                        item={item}
                        result={result}
                        inspectionId={inspection.inspectionId}
                        onChange={handleItemChange}
                      />
                    );
                  })}
                </div>
              </div>
            ))}

            {!isComplete && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className={cn(
                  'flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all disabled:opacity-60',
                  allRequiredResolved
                    ? 'bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25'
                    : 'bg-secondary/60 hover:bg-secondary text-foreground',
                )}
              >
                <CheckCircle2 className="w-5 h-5" />
                {completing
                  ? 'Finalizing…'
                  : allRequiredResolved
                    ? 'Finish Inspection'
                    : `Finish Inspection (${REQUIRED_ITEM_IDS.length - requiredResolvedCount} required item(s) left)`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
