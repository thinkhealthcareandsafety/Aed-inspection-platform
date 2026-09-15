'use client';

import { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Download, Mail, RotateCcw, XCircle, AlertTriangle } from 'lucide-react';
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
      <header className="px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-[30px] h-[30px] rounded-lg bg-primary flex items-center justify-center shrink-0">
            <PulseLogo className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="leading-none">
            <span className="font-display block text-[15px] font-bold tracking-tight">AED Inspect</span>
            <span className="block text-[10px] font-semibold text-primary tracking-wide mt-0.5">AI-AUTOMATED</span>
          </div>
        </div>
      </header>

      <div className="px-5 pb-5">
        <StepIndicator current={stepIndex} />
      </div>

      <div className="flex-1 max-w-3xl w-full mx-auto p-4 md:p-8 pt-2 flex flex-col gap-6 justify-center">
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
            <div className="text-center">
              <h1 className="font-display text-xl font-bold tracking-tight">{inspection.aedModel} Inspection</h1>
              <p className="text-muted-foreground text-sm mt-1.5">
                10 checks across 3 sections. Capture a photo (or short video) for each item — AI analyses it
                instantly.
              </p>
            </div>

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
                  className={cn('glass-card border p-6 flex flex-col items-center text-center gap-5', RESULT_STYLES[inspection.inspectionResult].ring)}
                >
                  <div
                    className={cn(
                      'w-14 h-14 rounded-full border flex items-center justify-center',
                      RESULT_STYLES[inspection.inspectionResult].iconWrap,
                    )}
                  >
                    {(() => {
                      const ResultIcon = RESULT_STYLES[inspection.inspectionResult].icon;
                      return <ResultIcon className="w-7 h-7" strokeWidth={2.25} />;
                    })()}
                  </div>

                  <div className="flex flex-col items-center gap-2">
                    <span
                      className={cn(
                        'inline-flex items-center px-3.5 py-1 rounded-full border text-xs font-bold font-mono tracking-wide',
                        RESULT_STYLES[inspection.inspectionResult].badge,
                      )}
                    >
                      {RESULT_STYLES[inspection.inspectionResult].label}
                    </span>
                    <h3 className="font-display text-lg font-bold">Inspection complete</h3>
                  </div>

                  {emailStatus && (
                    <div className="w-full flex items-start gap-2.5 bg-primary/5 rounded-xl px-4 py-3 text-left">
                      <Mail className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                      <p className="text-xs text-foreground/80 leading-relaxed">
                        {emailStatus.sent
                          ? <><span className="font-semibold text-foreground">Report emailed. </span>Sent to {emailStatus.recipients.join(' and ')}.</>
                          : 'Report email could not be sent — use the PDF button below.'}
                      </p>
                    </div>
                  )}

                  <div className="w-full flex flex-col gap-2.5">
                    <button
                      onClick={() => api.public.downloadPdf(inspection.inspectionId)}
                      className="w-full flex items-center justify-center gap-2 h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20"
                    >
                      <Download className="w-4 h-4" />
                      Download PDF report
                    </button>
                    <button
                      onClick={handleReset}
                      className="w-full flex items-center justify-center gap-2 h-12 rounded-xl border border-border bg-card hover:bg-secondary/60 text-sm font-semibold transition-colors"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Start new inspection
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
                        uploadFn={api.public.checklist.upload}
                        skipFn={api.public.checklist.skip}
                        aedModel={inspection.aedModel}
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
                    ? 'Finish Inspection & Email Report'
                    : `Finish Inspection (${REQUIRED_ITEM_IDS.length - requiredResolvedCount} required item(s) left)`}
              </button>
            )}
          </>
        )}
      </div>

      <BrandFooter />
    </div>
  );
}
