'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { track, installTrackingFlush } from '@/lib/track';
import type { ChecklistItemResult, Inspection, InspectionResult } from '@/types';

type Step = 'contact' | 'model' | 'inspecting';

/**
 * Inspections are done on a phone, in a stairwell, often one-handed — tabs get
 * backgrounded and killed, and a stray refresh shouldn't cost someone eight
 * analysed photos. Only the id is kept locally: the inspection itself (photos,
 * verdicts, contact details) already lives on the server, so recovery is a
 * re-fetch rather than a client-side copy of someone's personal data.
 */
const ACTIVE_INSPECTION_KEY = 'aed_active_inspection';
/** Past this, resuming is more confusing than helpful. */
const MAX_RESUME_AGE_MS = 24 * 60 * 60 * 1000;

function rememberInspection(id: string) {
  try {
    localStorage.setItem(ACTIVE_INSPECTION_KEY, id);
  } catch {
    // Private mode or storage disabled — resume just won't be available.
  }
}

function forgetInspection() {
  try {
    localStorage.removeItem(ACTIVE_INSPECTION_KEY);
  } catch {
    // Nothing to do.
  }
}

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
  /** 'checking' is a single frame reading localStorage; it exists so a stored
   *  inspection doesn't flash the empty contact form before restoring. */
  const [resume, setResume] = useState<'checking' | 'restoring' | 'done'>('checking');

  useEffect(() => {
    track('landing_view');
    return installTrackingFlush();
  }, []);

  useEffect(() => {
    let cancelled = false;

    let storedId: string | null = null;
    try {
      storedId = localStorage.getItem(ACTIVE_INSPECTION_KEY);
    } catch {
      storedId = null;
    }
    if (!storedId) {
      setResume('done');
      return;
    }

    setResume('restoring');
    api.public
      // A missing or expired inspection is an ordinary outcome here, not
      // something to interrupt the inspector with.
      .get(storedId, { skipErrorToast: true })
      .then((res) => {
        if (cancelled) return;
        const restored = res.data.inspection;
        const age = Date.now() - new Date(restored.startedAt).getTime();
        if (Number.isFinite(age) && age > MAX_RESUME_AGE_MS) {
          forgetInspection();
          return;
        }
        setInspection(restored);
        setContact({
          name: restored.guestName ?? '',
          email: restored.guestEmail ?? '',
          phone: restored.guestPhone ?? '',
        });
        setStep('inspecting');
        track('inspection_resumed', {
          inspectionId: restored.inspectionId,
          aedModel: restored.aedModel,
        });
      })
      .catch(() => {
        forgetInspection();
      })
      .finally(() => {
        if (!cancelled) setResume('done');
      });

    return () => {
      cancelled = true;
    };
  }, []);

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

  useEffect(() => {
    if (allRequiredResolved && inspection) {
      track('all_required_done', {
        inspectionId: inspection.inspectionId,
        aedModel: inspection.aedModel,
      });
    }
  }, [allRequiredResolved, inspection]);

  const handleContactSubmit = useCallback((data: ContactFormData) => {
    setContact(data);
    setStep('model');
    track('contact_submitted');
  }, []);

  const handleSelectModel = useCallback(
    async (aedModel: string) => {
      if (!contact || starting) return;
      setStarting(true);
      track('model_selected', { aedModel });
      try {
        const res = await api.public.createInspection({ ...contact, aedModel });
        rememberInspection(res.data.inspection.inspectionId);
        setInspection(res.data.inspection);
        setStep('inspecting');
        track('inspection_started', { inspectionId: res.data.inspection.inspectionId, aedModel });
      } catch {
        toast.error('Could not start inspection. Please try again.');
      } finally {
        setStarting(false);
      }
    },
    [contact, starting],
  );

  /** Read outside the state updater so tracking fires once per real change,
   *  not once per React re-invocation of the updater. */
  const inspectionRef = useRef<Inspection | null>(null);
  useEffect(() => {
    inspectionRef.current = inspection;
  }, [inspection]);

  const handleItemChange = useCallback((result: ChecklistItemResult) => {
    const prev = inspectionRef.current;
    const before = prev?.checklist.find((c) => c.itemId === result.itemId);
    const meta = { inspectionId: prev?.inspectionId, aedModel: prev?.aedModel, itemId: result.itemId };

    if (result.status === 'analyzing' && (before?.status === 'pass' || before?.status === 'fail')) {
      track('item_retaken', meta);
    } else if (result.status === 'pass' || result.status === 'fail') {
      track('item_analyzed', { ...meta, outcome: result.status });
      track('first_item_analyzed', { inspectionId: prev?.inspectionId, aedModel: prev?.aedModel });
    } else if (result.status === 'error') {
      track('item_analyzed', { ...meta, outcome: 'error' });
      track('item_error', meta);
    } else if (result.status === 'skipped') {
      track('item_skipped', meta);
    }

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
      track('inspection_completed', {
        inspectionId: inspection.inspectionId,
        aedModel: inspection.aedModel,
        outcome: res.data.inspection.inspectionResult,
      });
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
    forgetInspection();
    setStep('contact');
    setContact(null);
    setInspection(null);
    setEmailStatus(null);
  }, []);

  const stepIndex: 0 | 1 | 2 = step === 'contact' ? 0 : step === 'model' ? 1 : 2;

  /** After a refresh the live send-result is gone, but the inspection records
   *  whether the report was emailed — enough to keep the confirmation true. */
  const emailSummary =
    emailStatus ??
    (inspection?.emailSentAt && inspection.guestEmail
      ? { sent: true, recipients: [inspection.guestEmail] }
      : null);

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
        {resume !== 'done' && (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            {resume === 'restoring' && (
              <p className="text-callout text-muted-foreground">Picking up where you left off…</p>
            )}
          </div>
        )}

        <AnimatePresence mode="wait">
          {resume === 'done' && step === 'contact' && (
            <ContactForm key="contact" defaultValues={contact ?? undefined} onSubmit={handleContactSubmit} />
          )}

          {resume === 'done' && step === 'model' && (
            <ModelSelect
              key="model"
              selected={null}
              starting={starting}
              onSelect={handleSelectModel}
              onBack={() => setStep('contact')}
            />
          )}
        </AnimatePresence>

        {resume === 'done' && step === 'inspecting' && inspection && (
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

                  {emailSummary && (
                    <p className="text-footnote text-muted-foreground mt-5 flex items-start gap-1.5 text-left">
                      <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" strokeWidth={1.8} />
                      {emailSummary.sent
                        ? `Report emailed to ${emailSummary.recipients.join(' and ')}.`
                        : 'Report email could not be sent — download the PDF below.'}
                    </p>
                  )}

                  <div className="w-full flex flex-col gap-2.5 mt-7">
                    <button
                      onClick={() => {
                        track('report_downloaded', {
                          inspectionId: inspection.inspectionId,
                          aedModel: inspection.aedModel,
                        });
                        void api.public.downloadPdf(inspection.inspectionId);
                      }}
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
