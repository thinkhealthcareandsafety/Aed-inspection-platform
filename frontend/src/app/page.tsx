'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2, Download, Loader2, Mail, RotateCcw, XCircle, AlertTriangle, ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CHECKLIST_SECTIONS, REQUIRED_ITEM_IDS } from '@/lib/checklist-config';
import { ActiveCheck, CheckRow } from '@/components/inspection/ActiveCheck';
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
  /** The one check currently expanded. Null once everything is resolved. */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);

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

  const ALL_ITEMS = useMemo(() => CHECKLIST_SECTIONS.flatMap((s) => s.items), []);

  /** Open the first outstanding REQUIRED check as soon as there's an
   *  inspection to work on — including after a refresh, which lands mid-list.
   *  Never auto-opens an optional extra: with the required set finished, the
   *  thing to put in front of someone is the finish button. */
  const firstOutstandingRequired = useMemo(() => {
    if (!inspection) return undefined;
    const outstanding = (id: string) => {
      const st = inspection.checklist.find((c) => c.itemId === id)?.status;
      return st === 'pending' || st === 'error';
    };
    return CHECKLIST_SECTIONS.flatMap((s) => s.items)
      .filter((i) => i.required)
      .find((i) => outstanding(i.id))?.id;
  }, [inspection]);

  const [openedOnce, setOpenedOnce] = useState(false);
  useEffect(() => {
    if (!inspection || openedOnce) return;
    setOpenedOnce(true);
    setActiveId(firstOutstandingRequired ?? null);
  }, [inspection, openedOnce, firstOutstandingRequired]);

  /** Sorting each check into done / to-do / optional is what lets exactly one
   *  of them be on screen expanded while the rest stay one line each. */
  const groups = useMemo(() => {
    if (!inspection) return { done: [], todo: [], optional: [] };
    const statusOf = (id: string) => inspection.checklist.find((c) => c.itemId === id)?.status;
    const outstanding = (id: string) => {
      const s = statusOf(id);
      return s === 'pending' || s === 'error' || s === 'analyzing';
    };
    return {
      done: ALL_ITEMS.filter((i) => i.id !== activeId && !outstanding(i.id)),
      todo: ALL_ITEMS.filter((i) => i.id !== activeId && i.required && outstanding(i.id)),
      optional: ALL_ITEMS.filter((i) => i.id !== activeId && !i.required && outstanding(i.id)),
    };
  }, [inspection, activeId, ALL_ITEMS]);

  /** Required checks the AI marked as faults. Worth interrupting for: most
   *  are a thirty-second fix (reseat a connector, close a lid) and fixing one
   *  before finishing turns a FAIL report into a PASS — which is the actual
   *  point of inspecting an AED. */
  const failedRequired = useMemo(() => {
    if (!inspection) return [];
    return ALL_ITEMS.filter(
      (i) =>
        i.required &&
        inspection.checklist.find((c) => c.itemId === i.id)?.status === 'fail',
    );
  }, [inspection, ALL_ITEMS]);

  const activeItem = ALL_ITEMS.find((i) => i.id === activeId);
  const activeResult = inspection?.checklist.find((c) => c.itemId === activeId);

  /** "Check 3 of 6" counts required checks only — the optional extras are a
   *  bonus, and numbering them into the total makes the job look longer. */
  const activePosition = useMemo(() => {
    if (!activeItem?.required) return undefined;
    const required = ALL_ITEMS.filter((i) => i.required);
    const index = required.findIndex((i) => i.id === activeItem.id);
    return index < 0 ? undefined : { index: index + 1, total: required.length };
  }, [activeItem, ALL_ITEMS]);

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

  /**
   * Move to the next outstanding check once one is finished. Required checks
   * come first and in order; optional extras only once the required set is
   * clear. The pause between "done" and "what now" is where people put the
   * phone down, so this closes it.
   */
  const handleAdvance = useCallback(
    (doneId: string) => {
      const current = inspectionRef.current;
      const outstanding = (id: string) => {
        const s = current?.checklist.find((c) => c.itemId === id)?.status;
        return s === 'pending' || s === 'error';
      };
      // Only ever auto-advance within the required set. Once those are done
      // the next thing to offer is the finish button, not a fourth optional
      // extra — pushing someone into bonus work right after they've earned
      // the report is how a three-minute job starts feeling like ten.
      const next =
        ALL_ITEMS.map((i) => i.id)
          .filter((id) => id !== doneId)
          .find((id) => REQUIRED_ITEM_IDS.includes(id) && outstanding(id)) ?? null;
      setActiveId(next);
      if (next && typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [ALL_ITEMS],
  );

  const handleReset = useCallback(() => {
    forgetInspection();
    setActiveId(null);
    setOpenedOnce(false);
    setShowOptional(false);
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
      {/* Chrome shares the content column's gutters, so on a wide screen the
          wordmark sits over the content instead of drifting to the far edge. */}
      <header className="max-w-3xl w-full mx-auto px-4 md:px-8 pt-5 pb-4 flex items-center gap-2.5">
        <PulseLogo className="w-[18px] h-[18px] text-foreground shrink-0" />
        <span className="text-headline text-foreground">AED Inspect</span>
      </header>

      <div className="max-w-3xl w-full mx-auto px-4 md:px-8 pb-6">
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
              <div className="flex items-baseline justify-between gap-3 mt-3">
                <span className="text-callout text-muted-foreground">
                  {allRequiredResolved
                    ? 'All required checks done'
                    : `${REQUIRED_ITEM_IDS.length - requiredResolvedCount} required ${
                        REQUIRED_ITEM_IDS.length - requiredResolvedCount === 1 ? 'check' : 'checks'
                      } to go`}
                </span>
                <span className="text-callout font-mono tabular-nums text-foreground shrink-0">
                  {requiredResolvedCount}/{REQUIRED_ITEM_IDS.length}
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-border overflow-hidden mt-2">
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

            {/* The one check being done right now. */}
            {!isComplete && activeItem && activeResult && (
              <ActiveCheck
                key={activeItem.id}
                item={activeItem}
                result={activeResult}
                position={activePosition}
                inspectionId={inspection.inspectionId}
                aedModel={inspection.aedModel}
                onChange={handleItemChange}
                onDone={handleAdvance}
                uploadFn={api.public.checklist.upload}
                skipFn={api.public.checklist.skip}
              />
            )}

            {/* Everything else stays one line each — the whole job remains
                visible without putting ten camera buttons on one screen. */}
            {groups.todo.length > 0 && (
              <section>
                <div className="group-label">Still to do</div>
                <div className="surface-group">
                  {groups.todo.map((item) => {
                    const result = inspection.checklist.find((c) => c.itemId === item.id);
                    if (!result) return null;
                    return (
                      <CheckRow key={item.id} item={item} result={result} onSelect={() => setActiveId(item.id)} />
                    );
                  })}
                </div>
              </section>
            )}

            {groups.done.length > 0 && (
              <section>
                <div className="group-label">Done ({groups.done.length})</div>
                <div className="surface-group">
                  {groups.done.map((item) => {
                    const result = inspection.checklist.find((c) => c.itemId === item.id);
                    if (!result) return null;
                    return (
                      <CheckRow key={item.id} item={item} result={result} onSelect={() => setActiveId(item.id)} />
                    );
                  })}
                </div>
              </section>
            )}

            {/* Folded away by default: four optional extras on screen make a
                six-check job look like a ten-check one. */}
            {groups.optional.length > 0 && !isComplete && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowOptional((v) => !v)}
                  className="group-label flex items-center gap-1.5 hover:text-foreground transition-colors"
                  aria-expanded={showOptional}
                >
                  Optional extras ({groups.optional.length})
                  <ChevronDown
                    className={cn('w-3.5 h-3.5 transition-transform', showOptional && 'rotate-180')}
                    strokeWidth={2.2}
                  />
                </button>
                {showOptional && (
                  <div className="surface-group fade-in">
                    {groups.optional.map((item) => {
                      const result = inspection.checklist.find((c) => c.itemId === item.id);
                      if (!result) return null;
                      return (
                        <CheckRow key={item.id} item={item} result={result} onSelect={() => setActiveId(item.id)} />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {!isComplete && allRequiredResolved && failedRequired.length > 0 && (
              <div className="surface-group p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle
                    className="w-4 h-4 mt-0.5 shrink-0"
                    strokeWidth={2.1}
                    style={{ color: 'var(--status-serious)' }}
                  />
                  <div className="min-w-0">
                    <p className="text-headline text-foreground">
                      {failedRequired.length === 1
                        ? '1 check needs attention'
                        : `${failedRequired.length} checks need attention`}
                    </p>
                    <p className="text-footnote text-muted-foreground mt-1">
                      Most of these take under a minute to put right. Fix it, retake the photo, and
                      your report comes out as a pass.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  {failedRequired.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveId(item.id);
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                      }}
                      className="pressable h-9 px-3 rounded-xl bg-secondary hover:bg-secondary/80 text-callout text-foreground transition-colors"
                    >
                      Fix {item.title.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* The finish button is earned, not decoration: a dead grey bar
                repeating the count already in the header sat at the bottom of
                the screen for the whole inspection. It now arrives, with
                motion, at the moment it can actually be pressed. */}
            <AnimatePresence>
              {!isComplete && allRequiredResolved && (
                <motion.button
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={springSnappy}
                  onClick={handleComplete}
                  disabled={completing}
                  className="pressable flex items-center justify-center gap-2 h-[52px] rounded-2xl text-headline bg-primary hover:bg-primary/92 text-primary-foreground transition-colors disabled:opacity-50"
                >
                  {completing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {completing ? 'Finishing…' : 'Finish & email my report'}
                </motion.button>
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      <BrandFooter />
    </div>
  );
}
