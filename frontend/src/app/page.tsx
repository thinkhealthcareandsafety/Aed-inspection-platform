'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Download, Loader2, Mail, RotateCcw, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CHECKLIST_SECTIONS, REQUIRED_ITEM_IDS } from '@/lib/checklist-config';
import { ChecklistItemCard } from '@/components/inspection/ChecklistItemCard';
import { ContactForm, type ContactFormData } from '@/components/public/ContactForm';
import { ModelSelect } from '@/components/public/ModelSelect';
import { StepIndicator } from '@/components/public/StepIndicator';
import { BrandFooter } from '@/components/public/BrandFooter';
import { PulseLogo } from '@/components/icons';
import { springSnappy, springSoft } from '@/lib/motion';
import type { ChecklistItemResult, Inspection, InspectionResult } from '@/types';

type Step = 'contact' | 'model' | 'inspecting';

const RESULT_STYLES: Record<
  InspectionResult,
  { label: string; icon: typeof CheckCircle2; ring: string; iconWrap: string; badge: string }
> = {
  PASS: {
    label: 'PASS',
    icon: CheckCircle2,
    ring: 'border-emerald-200 dark:border-emerald-500/25',
    iconWrap: 'bg-emerald-50 border-emerald-200 text-emerald-600 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/30',
  },
  FAIL: {
    label: 'FAIL',
    icon: XCircle,
    ring: 'border-red-200 dark:border-red-500/25',
    iconWrap: 'bg-red-50 border-red-200 text-destructive dark:bg-red-500/10 dark:border-red-500/25 dark:text-red-400',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-400 dark:border-red-500/30',
  },
  REVIEW: {
    label: 'NEEDS REVIEW',
    icon: AlertTriangle,
    ring: 'border-amber-200 dark:border-amber-500/25',
    iconWrap: 'bg-amber-50 border-amber-200 text-amber-600 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/30',
  },
  INCOMPLETE: {
    label: 'INCOMPLETE',
    icon: AlertTriangle,
    ring: 'border-border',
    iconWrap: 'bg-secondary border-border text-muted-foreground',
    badge: 'bg-secondary text-muted-foreground border-border',
  },
};

export default function PublicInspectionPage() {
  const [step, setStep] = useState<Step>('contact');
  const [contact, setContact] = useState<ContactFormData | null>(null);
  const [starting, setStarting] = useState(false);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [completing, setCompleting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; recipients: string[] } | null>(null);

  const requiredResolvedCount = useMemo(() => {
    if (!inspection) return 0;
    return inspection.checklist.filter(
      (c) => REQUIRED_ITEM_IDS.includes(c.itemId) && (c.status === 'pass' || c.status === 'fail'),
    ).length;
  }, [inspection]);

  /** The single item the inspector should tackle next: required items first,
   *  in order, then optional ones. Drives the one filled button on screen. */
  const nextItemId = useMemo(() => {
    if (!inspection) return undefined;
    const needsAction = (id: string) => {
      const entry = inspection.checklist.find((c) => c.itemId === id);
      return entry?.status === 'pending' || entry?.status === 'error';
    };
    const ordered = CHECKLIST_SECTIONS.flatMap((s) => s.items.map((i) => i.id));
    return ordered.find((id) => REQUIRED_ITEM_IDS.includes(id) && needsAction(id)) ?? ordered.find(needsAction);
  }, [inspection]);

  const allRequiredResolved = requiredResolvedCount === REQUIRED_ITEM_IDS.length;
  const progressPct = Math.round((requiredResolvedCount / REQUIRED_ITEM_IDS.length) * 100);
  const isComplete = inspection?.inspectionStatus === 'complete';

  const handleContactSubmit = useCallback((data: ContactFormData) => {
    setContact(data);
    setStep('model');
  }, []);

  const handleSelectModel = useCallback(
    async (aedModel: string) => {
      if (!contact || starting) return;
      setStarting(true);
      try {
        const res = await api.public.createInspection({ ...contact, aedModel });
        setInspection(res.data.inspection);
        setStep('inspecting');
      } catch {
        toast.error('Could not start inspection. Please try again.');
      } finally {
        setStarting(false);
      }
    },
    [contact, starting],
  );

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
      const res = await api.public.complete(inspection.inspectionId);
      setInspection(res.data.inspection);
      setEmailStatus(res.data.email);
      if (res.data.email.sent) {
        toast.success('Report emailed to you.');
      } else {
        toast.error('Inspection saved, but the report email could not be sent.');
      }
    } catch {
      toast.error('Could not finalize inspection');
    } finally {
      setCompleting(false);
    }
  }, [inspection]);

  const handleReset = useCallback(() => {
    setStep('contact');
    setContact(null);
    setInspection(null);
    setEmailStatus(null);
  }, []);

  const stepIndex: 0 | 1 | 2 = step === 'contact' ? 0 : step === 'model' ? 1 : 2;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-5 pt-5 pb-4 flex items-center gap-2.5">
        <PulseLogo className="w-[18px] h-[18px] text-foreground shrink-0" />
        <span className="text-headline text-foreground">AED Inspect</span>
      </header>

      <div className="px-5 pb-6">
        <StepIndicator current={stepIndex} />
      </div>

      <div className="flex-1 max-w-3xl w-full mx-auto px-4 pb-8 md:px-8 flex flex-col gap-6 justify-center">
        <AnimatePresence mode="wait">
          {step === 'contact' && (
            <ContactForm key="contact" defaultValues={contact ?? undefined} onSubmit={handleContactSubmit} />
          )}

          {step === 'model' && (
            <ModelSelect
              key="model"
              selected={null}
              starting={starting}
              onSelect={handleSelectModel}
              onBack={() => setStep('contact')}
            />
          )}
        </AnimatePresence>

        {step === 'inspecting' && inspection && (
          <>
            <div className="px-1">
              <h1 className="text-title text-foreground">{inspection.aedModel}</h1>
              <p className="text-body text-muted-foreground mt-1.5">
                Ten checks across three sections. Capture each one — the AI reads it instantly.
              </p>
            </div>

            {/* Progress */}
            <div className="px-1">
              <div className="flex items-baseline justify-between mb-2">
                <span className="text-callout text-muted-foreground">Required items</span>
                <span className="text-callout font-mono text-foreground">
                  {requiredResolvedCount}/{REQUIRED_ITEM_IDS.length}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden">
                <motion.div
                  className="h-full bg-foreground rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPct}%` }}
                  transition={springSoft}
                />
              </div>
            </div>

            <AnimatePresence>
              {isComplete && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springSnappy}
                  className="surface-group p-7 flex flex-col items-center text-center"
                >
                  <div
                    className={cn(
                      'w-16 h-16 rounded-full flex items-center justify-center',
                      RESULT_STYLES[inspection.inspectionResult].iconWrap,
                    )}
                  >
                    {(() => {
                      const ResultIcon = RESULT_STYLES[inspection.inspectionResult].icon;
                      return <ResultIcon className="w-8 h-8" strokeWidth={2} />;
                    })()}
                  </div>

                  <h3 className="text-title text-foreground mt-5">
                    {RESULT_STYLES[inspection.inspectionResult].label}
                  </h3>
                  <p className="text-body text-muted-foreground mt-1.5">
                    {inspection.aedModel} · {requiredResolvedCount} of {REQUIRED_ITEM_IDS.length} required checks
                  </p>

                  {emailStatus && (
                    <p className="text-footnote text-muted-foreground mt-5 flex items-start gap-1.5 text-left">
                      <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.8} />
                      {emailStatus.sent
                        ? `Report emailed to ${emailStatus.recipients.join(' and ')}.`
                        : 'Report email could not be sent — download the PDF below.'}
                    </p>
                  )}

                  <div className="w-full flex flex-col gap-2.5 mt-7">
                    <button
                      onClick={() => api.public.downloadPdf(inspection.inspectionId)}
                      className="pressable w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-primary-foreground text-callout font-medium hover:bg-primary/92 transition-colors"
                    >
                      <Download className="w-4 h-4" strokeWidth={2} />
                      Download PDF report
                    </button>
                    <button
                      onClick={handleReset}
                      className="pressable w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-secondary hover:bg-secondary/80 text-callout font-medium transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" strokeWidth={2} />
                      Start new inspection
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sections */}
            {CHECKLIST_SECTIONS.map((section) => (
              <div key={section.section}>
                <div className="group-label">{section.title}</div>
                <div className="surface-group">
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
                        uploadFn={api.public.checklist.upload}
                        skipFn={api.public.checklist.skip}
                        aedModel={inspection.aedModel}
                        isNext={item.id === nextItemId}
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
                  'pressable flex items-center justify-center gap-2 h-[52px] rounded-2xl text-headline transition-colors disabled:opacity-50',
                  allRequiredResolved
                    ? 'bg-primary hover:bg-primary/92 text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80 text-muted-foreground',
                )}
              >
                {completing && <Loader2 className="w-4 h-4 animate-spin" />}
                {completing
                  ? 'Finishing…'
                  : allRequiredResolved
                    ? 'Finish & email report'
                    : `${REQUIRED_ITEM_IDS.length - requiredResolvedCount} required ${
                        REQUIRED_ITEM_IDS.length - requiredResolvedCount === 1 ? 'item' : 'items'
                      } left`}
              </button>
            )}
          </>
        )}
      </div>

      <BrandFooter />
    </div>
  );
}
