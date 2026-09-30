'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, ChevronDown, Loader2, MoreHorizontal, WifiOff } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { CHECKLIST_SECTIONS, REQUIRED_ITEM_IDS } from '@/lib/checklist-config';
import { modelDisplayName } from '@/lib/aed-models';
import { readingOf } from '@/lib/readings';
import { preloadReferenceImages } from '@/lib/reference-examples';
import { ActiveCheck, CheckRow } from '@/components/inspection/ActiveCheck';
import { ProgressRail } from '@/components/inspection/ProgressRail';
import { ContactForm, type ContactFormData } from '@/components/public/ContactForm';
import { ModelSelect } from '@/components/public/ModelSelect';
import { InspectionComplete } from '@/components/public/InspectionComplete';
import { StepIndicator } from '@/components/public/StepIndicator';
import { BrandFooter } from '@/components/public/BrandFooter';
import { BrandLockup } from '@/components/public/BrandLockup';
import { LanguageSwitch } from '@/components/public/LanguageSwitch';
import { useI18n } from '@/i18n';
import { springSnappy } from '@/lib/motion';
import { track, installTrackingFlush } from '@/lib/track';
import { usePending } from '@/lib/use-pending';
import { useElapsed } from '@/lib/use-elapsed';
import { useIsDesktop, useOnline } from '@/lib/use-device';
import type { MenuView } from '@/components/public/InspectionMenu';
import type { ChecklistItemResult, Inspection, ReplacementRequest } from '@/types';

const loadInspectionMenu = () => import('@/components/public/InspectionMenu');
const InspectionMenu = dynamic(loadInspectionMenu, { ssr: false });

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

/** Says out loud that the network went, and what that means for the job —
 *  otherwise the next failed upload reads as the app breaking. */
function OfflineStrip() {
  const { m } = useI18n();
  return (
    <div role="status" className="border-t border-amber-500/25 bg-amber-500/10">
      <p className="mx-auto flex max-w-md items-start gap-2 px-4 py-2 text-footnote text-foreground">
        <WifiOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" strokeWidth={2.2} />
        <span>
          <span className="font-semibold">{m.inspection.offlineTitle}</span> {m.inspection.offlineBody}
        </span>
      </p>
    </div>
  );
}

export default function PublicInspectionPage() {
  const { lang, m } = useI18n();
  const [step, setStep] = useState<Step>('contact');
  const [contact, setContact] = useState<ContactFormData | null>(null);
  const [starting, setStarting] = useState(false);
  /** Which model row was tapped, so that row — not every row — shows the
   *  spinner. It was hard-wired to null, so a tap only faded the whole list
   *  and gave no sign of which choice had registered. */
  const [pendingModel, setPendingModel] = useState<string | null>(null);
  const [downloadingPdf, runPdfDownload] = usePending();
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [completing, setCompleting] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{ sent: boolean; recipients: string[] } | null>(null);
  /** 'checking' is a single frame reading localStorage; it exists so a stored
   *  inspection doesn't flash the empty contact form before restoring. */
  const [resume, setResume] = useState<'checking' | 'restoring' | 'done'>('checking');
  /** The one check currently expanded. Null once everything is resolved. */
  const [activeId, setActiveId] = useState<string | null>(null);
  const [showOptional, setShowOptional] = useState(false);
  /** The header's options sheet, and which face of it is showing. */
  const [menu, setMenu] = useState<MenuView | null>(null);
  const isDesktop = useIsDesktop();
  const online = useOnline();

  useEffect(() => {
    track('landing_view');
    return installTrackingFlush();
  }, []);

  useEffect(() => {
    let cancelled = false;

    // A hand-off link (the QR code on a laptop) names the inspection in the
    // URL. It's adopted as this device's active inspection and then dropped
    // from the address bar, so a later refresh or share doesn't carry it.
    let storedId: string | null = null;
    try {
      const params = new URLSearchParams(window.location.search);
      const handedOff = params.get('resume');
      if (handedOff && /^[0-9a-f-]{36}$/i.test(handedOff)) {
        storedId = handedOff;
        rememberInspection(handedOff);
      }
      if (handedOff !== null) {
        params.delete('resume');
        const rest = params.toString();
        window.history.replaceState(null, '', `${window.location.pathname}${rest ? `?${rest}` : ''}${window.location.hash}`);
      }
    } catch {
      // A malformed URL just means no hand-off.
    }
    if (!storedId) {
      try {
        storedId = localStorage.getItem(ACTIVE_INSPECTION_KEY);
      } catch {
        storedId = null;
      }
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

  const allRequiredResolved = requiredResolvedCount === REQUIRED_ITEM_IDS.length;
  const isComplete = inspection?.inspectionStatus === 'complete';

  const ALL_ITEMS = useMemo(() => CHECKLIST_SECTIONS.flatMap((s) => s.items), []);
  const REQUIRED_ITEMS = useMemo(() => ALL_ITEMS.filter((i) => i.required), [ALL_ITEMS]);

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
    return REQUIRED_ITEMS.find((i) => outstanding(i.id))?.id;
  }, [inspection, REQUIRED_ITEMS]);

  // Every example this model's checks will show, fetched while the first
  // check is being read — so the next one's photo is already on screen.
  const inspectionModel = inspection?.aedModel;
  useEffect(() => preloadReferenceImages(inspectionModel), [inspectionModel]);

  const [openedOnce, setOpenedOnce] = useState(false);
  useEffect(() => {
    if (!inspection || openedOnce) return;
    setOpenedOnce(true);
    setActiveId(firstOutstandingRequired ?? null);
  }, [inspection, openedOnce, firstOutstandingRequired]);

  /** Every check but the open one, in inspection order: the six required
   *  ones always (numbered, so the list reads as a route, not a pile), plus
   *  any optional extra already done. Items stay where they are as they get
   *  ticked off — they used to jump between "Still to do" and "Done". */
  const listed = useMemo(() => {
    if (!inspection) return { checklist: [], optional: [] };
    const statusOf = (id: string) => inspection.checklist.find((c) => c.itemId === id)?.status;
    const outstanding = (id: string) => {
      const s = statusOf(id);
      return s === 'pending' || s === 'error' || s === 'analyzing';
    };
    return {
      checklist: ALL_ITEMS.filter((i) => i.id !== activeId && (i.required || !outstanding(i.id))),
      optional: ALL_ITEMS.filter((i) => i.id !== activeId && !i.required && outstanding(i.id)),
    };
  }, [inspection, activeId, ALL_ITEMS]);

  /** Required checks the AI marked as faults. Worth interrupting for: most
   *  are a thirty-second fix (reseat a connector, close a lid) and fixing one
   *  before finishing turns a FAIL report into a PASS — which is the actual
   *  point of inspecting an AED. */
  const failedRequired = useMemo(() => {
    if (!inspection) return [];
    return REQUIRED_ITEMS.filter(
      (i) => inspection.checklist.find((c) => c.itemId === i.id)?.status === 'fail',
    );
  }, [inspection, REQUIRED_ITEMS]);

  /** An expired date is the one fault retaking can't fix, so it is pointed
   *  at the replacement quote on the result screen instead. */
  const { fixable, expired } = useMemo(() => {
    const isExpired = (id: string) => {
      const entry = inspection?.checklist.find((c) => c.itemId === id);
      const expiry = entry ? readingOf(entry)?.expiry : undefined;
      return Boolean(expiry && expiry.days < 0);
    };
    return {
      fixable: failedRequired.filter((i) => !isExpired(i.id)),
      expired: failedRequired.filter((i) => isExpired(i.id)),
    };
  }, [inspection, failedRequired]);

  const activeItem = ALL_ITEMS.find((i) => i.id === activeId);
  const activeResult = inspection?.checklist.find((c) => c.itemId === activeId);

  /** "Check 3 of 6" counts required checks only — the optional extras are a
   *  bonus, and numbering them into the total makes the job look longer. */
  const activePosition = useMemo(() => {
    if (!activeItem?.required) return undefined;
    const index = REQUIRED_ITEMS.findIndex((i) => i.id === activeItem.id);
    return index < 0 ? undefined : { index: index + 1, total: REQUIRED_ITEMS.length };
  }, [activeItem, REQUIRED_ITEMS]);

  /** Where moving on from the open check leads, said on its button — the
   *  same rule handleAdvance follows. */
  const nextLabel = useMemo(() => {
    const outstanding = (id: string) => {
      if (id === activeId) return false;
      const s = inspection?.checklist.find((c) => c.itemId === id)?.status;
      return s === 'pending' || s === 'error';
    };
    if (ALL_ITEMS.some((i) => i.required && outstanding(i.id))) return m.check.next.check;
    if (activeItem && !activeItem.required && ALL_ITEMS.some((i) => !i.required && outstanding(i.id))) {
      return m.check.next.extra;
    }
    return m.check.next.finish;
  }, [inspection, activeId, activeItem, ALL_ITEMS, m]);

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
      setPendingModel(aedModel);
      track('model_selected', { aedModel });
      try {
        const res = await api.public.createInspection({ ...contact, aedModel });
        rememberInspection(res.data.inspection.inspectionId);
        setInspection(res.data.inspection);
        setStep('inspecting');
        track('inspection_started', { inspectionId: res.data.inspection.inspectionId, aedModel });
      } catch {
        toast.error(m.inspection.startFailed);
      } finally {
        setStarting(false);
        setPendingModel(null);
      }
    },
    [contact, starting, m],
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
      // The result screen says whether the email went out, so no toast.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      toast.error(m.inspection.finishFailed);
    } finally {
      setCompleting(false);
    }
  }, [inspection, m]);

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
      // The exception is someone who opened the extras themselves: they are
      // carried through the rest of them, not dropped back after one.
      const rest = ALL_ITEMS.map((i) => i.id).filter((id) => id !== doneId);
      const inExtras = ALL_ITEMS.some((i) => i.id === doneId && !i.required);
      const next =
        rest.find((id) => REQUIRED_ITEM_IDS.includes(id) && outstanding(id)) ??
        (inExtras ? rest.find((id) => !REQUIRED_ITEM_IDS.includes(id) && outstanding(id)) : undefined) ??
        null;
      setActiveId(next);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [ALL_ITEMS],
  );

  const openCheck = useCallback((id: string) => {
    setActiveId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

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

  /** A facilities manager rarely has one AED. The next one should cost a
   *  single tap on the model, not the whole contact form again. */
  const handleInspectAnother = useCallback(() => {
    forgetInspection();
    setActiveId(null);
    setOpenedOnce(false);
    setShowOptional(false);
    setInspection(null);
    setEmailStatus(null);
    setStep(contact ? 'model' : 'contact');
    window.scrollTo({ top: 0 });
  }, [contact]);

  const handleReplacementRequested = useCallback((request: ReplacementRequest) => {
    setInspection((prev) => (prev ? { ...prev, replacementRequest: request } : prev));
  }, []);

  // The options sheet is code-split; fetch it once the page is idle so the
  // first tap on "⋯" opens instantly rather than waiting on the network.
  useEffect(() => {
    if (step !== 'inspecting') return;
    const id = window.setTimeout(() => void loadInspectionMenu(), 2500);
    return () => window.clearTimeout(id);
  }, [step]);

  /** Mid-inspection escape: the unit in hand isn't the one that was picked. */
  const handleSwitchModel = useCallback(() => {
    setMenu(null);
    handleInspectAnother();
  }, [handleInspectAnother]);

  const handleStartOver = useCallback(() => {
    setMenu(null);
    handleReset();
    window.scrollTo({ top: 0 });
  }, [handleReset]);

  /** On a laptop, "Take the photo" opens a file browser. This link reopens
   *  the same inspection on a phone, where it opens the camera. */
  const handoffUrl =
    isDesktop && inspection && typeof window !== 'undefined'
      ? `${window.location.origin}/?resume=${inspection.inspectionId}${lang === 'hi' ? '&lang=hi' : ''}`
      : null;
  const openHandoff = useCallback(() => setMenu('phone'), []);

  const stepIndex: 0 | 1 | 2 = step === 'contact' ? 0 : step === 'model' ? 1 : 2;

  // Finishing saves the result, renders the PDF with its photos, and sends it:
  // a few seconds, so the button says which of those it is on rather than
  // sitting on one word.
  const finishingElapsed = useElapsed(completing);
  const finishingLabel = m.inspection.finishing[finishingElapsed < 1200 ? 0 : finishingElapsed < 4000 ? 1 : 2];

  /** After a refresh the live send-result is gone, but the inspection records
   *  whether the report was emailed — enough to keep the confirmation true. */
  const emailSummary =
    emailStatus ??
    (inspection?.emailSentAt && inspection.guestEmail
      ? { sent: true, recipients: [inspection.guestEmail] }
      : null);

  const inspecting = resume === 'done' && step === 'inspecting' && inspection !== null;
  const readyToFinish = !isComplete && !activeItem && allRequiredResolved;

  const expiredKinds = expired.map((i) => (i.id === 'pads_expiry' ? ('pads' as const) : ('battery' as const)));
  const expiredSentence = expiredKinds.length ? m.inspection.ready.expired(expiredKinds) : '';

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {inspecting && inspection ? (
        // One bar for the whole job: which AED, how far along, and — from the
        // colour of each segment — which checks passed and which didn't.
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/70">
          <div className="max-w-md w-full mx-auto px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="text-headline text-foreground truncate min-w-0 flex-1">
                {modelDisplayName(inspection.aedModel)}
              </span>
              {!isComplete && (
                <span className="text-callout tabular-nums text-muted-foreground shrink-0">
                  {m.inspection.doneCount(
                    <span className="text-foreground font-semibold">{requiredResolvedCount}</span>,
                    REQUIRED_ITEM_IDS.length,
                  )}
                </span>
              )}
              {/* With the job done there is no options menu, so the language
                  switch sits in the bar itself for reading the result. */}
              {isComplete && <LanguageSwitch className="-mr-2" />}
              {!isComplete && (
                <button
                  type="button"
                  onClick={() => setMenu('menu')}
                  onPointerEnter={() => void loadInspectionMenu()}
                  aria-label={m.inspection.options}
                  aria-haspopup="dialog"
                  className="-mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
                </button>
              )}
            </div>
            <ProgressRail
              className="mt-2.5"
              items={REQUIRED_ITEMS}
              checklist={inspection.checklist}
              activeId={isComplete ? null : activeId}
            />
          </div>
          {!online && <OfflineStrip />}
        </header>
      ) : (
        <>
          {/* Chrome shares the content column's gutters, so on a wide screen the
              wordmark sits over the content instead of drifting to the far edge. */}
          <header className="max-w-md w-full mx-auto px-4 pt-5 pb-4 flex items-center gap-2.5">
            <BrandLockup className="flex-1 min-w-0" />
            <LanguageSwitch className="-my-1.5 -mr-2" />
          </header>
          {!online && <OfflineStrip />}

          <div className="max-w-md w-full mx-auto px-4 pb-6">
            <StepIndicator current={stepIndex} />
          </div>
        </>
      )}

      {menu && inspection && (
        <InspectionMenu
          view={menu}
          onViewChange={setMenu}
          onClose={() => setMenu(null)}
          modelName={modelDisplayName(inspection.aedModel)}
          doneCount={requiredResolvedCount}
          onSwitchModel={handleSwitchModel}
          onStartOver={handleStartOver}
          handoffUrl={handoffUrl}
        />
      )}

      <div
        className={cn(
          'flex-1 max-w-md w-full mx-auto px-4 pb-8 flex flex-col gap-6',
          inspecting ? 'pt-5' : 'justify-center',
        )}
      >
        {resume !== 'done' && (
          <div className="flex flex-col items-center justify-center gap-3 py-24">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
            {resume === 'restoring' && (
              <p className="text-callout text-muted-foreground">{m.inspection.restoring}</p>
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
              selected={pendingModel}
              starting={starting}
              contact={contact}
              onSelect={handleSelectModel}
              onBack={() => setStep('contact')}
            />
          )}
        </AnimatePresence>

        {inspecting && inspection && isComplete && (
          <InspectionComplete
            inspection={inspection}
            emailed={emailSummary?.sent ?? false}
            downloading={downloadingPdf}
            onDownload={() => {
              track('report_downloaded', {
                inspectionId: inspection.inspectionId,
                aedModel: inspection.aedModel,
              });
              void runPdfDownload(() => api.public.downloadPdf(inspection.inspectionId));
            }}
            onInspectAnother={handleInspectAnother}
            onStartOver={handleReset}
            onReplacementRequested={handleReplacementRequested}
          />
        )}

        {inspecting && inspection && !isComplete && (
          <>
            {/* The one check being done right now. */}
            {activeItem && activeResult && (
              <ActiveCheck
                key={activeItem.id}
                item={activeItem}
                result={activeResult}
                position={activePosition}
                inspectionId={inspection.inspectionId}
                aedModel={inspection.aedModel}
                nextLabel={nextLabel}
                onChange={handleItemChange}
                onDone={handleAdvance}
                uploadFn={api.public.checklist.upload}
                skipFn={api.public.checklist.skip}
                onContinueOnPhone={handoffUrl ? openHandoff : undefined}
              />
            )}

            {/* Every required check answered: say so, point at anything
                still worth fixing, and hand over to the finish button. */}
            {readyToFinish && (
              <motion.section
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springSnappy}
                className="surface-card px-6 pt-7 pb-6 text-center"
              >
                <span
                  className={cn(
                    'mx-auto w-14 h-14 rounded-full flex items-center justify-center text-white',
                    failedRequired.length ? 'bg-amber-500' : 'bg-emerald-600',
                  )}
                >
                  {failedRequired.length ? (
                    <AlertTriangle className="w-7 h-7" strokeWidth={2.2} />
                  ) : (
                    <Check className="w-7 h-7" strokeWidth={3} />
                  )}
                </span>
                <h2 className="text-title text-foreground mt-4">
                  {failedRequired.length === 0
                    ? m.inspection.ready.allDone(REQUIRED_ITEM_IDS.length)
                    : m.inspection.ready.needAttention(failedRequired.length)}
                </h2>
                <p className="text-body text-muted-foreground mt-1.5">
                  {failedRequired.length === 0
                    ? m.inspection.ready.finishHint
                    : [
                        fixable.length ? m.inspection.ready.fixable : '',
                        expiredSentence,
                      ]
                        .filter(Boolean)
                        .join(' ')}
                </p>
                {fixable.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-2 mt-4">
                    {fixable.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openCheck(item.id)}
                        className="pressable h-10 px-3.5 rounded-xl bg-secondary hover:bg-secondary/75 text-callout font-medium text-foreground transition-colors"
                      >
                        {m.inspection.ready.retake(m.items[item.id]?.title ?? item.title)}
                      </button>
                    ))}
                  </div>
                )}
                {listed.optional.length > 0 && (
                  <button
                    type="button"
                    onClick={() => openCheck(listed.optional[0].id)}
                    className="mt-5 h-10 px-3 text-callout font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    {m.inspection.ready.addOptional(listed.optional.length)}
                  </button>
                )}
              </motion.section>
            )}

            {listed.checklist.length > 0 && (
              <section>
                <div className="group-label">{m.inspection.checklist}</div>
                <div className="surface-group">
                  {listed.checklist.map((item) => {
                    const result = inspection.checklist.find((c) => c.itemId === item.id);
                    if (!result) return null;
                    const index = REQUIRED_ITEMS.findIndex((r) => r.id === item.id);
                    return (
                      <CheckRow
                        key={item.id}
                        item={item}
                        result={result}
                        index={index >= 0 ? index + 1 : undefined}
                        onSelect={() => openCheck(item.id)}
                      />
                    );
                  })}
                </div>
              </section>
            )}

            {/* Folded away by default: four optional extras on screen make a
                six-check job look like a ten-check one. */}
            {listed.optional.length > 0 && (
              <section>
                <button
                  type="button"
                  onClick={() => setShowOptional((v) => !v)}
                  className="group-label flex h-11 items-center gap-1.5 pb-0 hover:text-foreground transition-colors"
                  aria-expanded={showOptional}
                >
                  {m.inspection.optionalExtras(listed.optional.length)}
                  <ChevronDown
                    className={cn('w-3.5 h-3.5 transition-transform', showOptional && 'rotate-180')}
                    strokeWidth={2.2}
                  />
                </button>
                {showOptional && (
                  <div className="surface-group fade-in">
                    {listed.optional.map((item) => {
                      const result = inspection.checklist.find((c) => c.itemId === item.id);
                      if (!result) return null;
                      return (
                        <CheckRow key={item.id} item={item} result={result} onSelect={() => openCheck(item.id)} />
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {/* The finish button is earned, not decoration: it arrives, with
                motion, at the moment it can actually be pressed — and then
                stays pinned under the thumb while the list is reviewed. */}
            {readyToFinish && (
              <div className="sticky bottom-0 z-20 -mx-4 px-4 pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] bg-gradient-to-t from-background from-55% to-background/0">
                <motion.button
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springSnappy}
                  onClick={handleComplete}
                  disabled={completing}
                  className="pressable w-full flex items-center justify-center gap-2 h-[52px] rounded-2xl text-headline bg-primary hover:bg-primary/92 text-primary-foreground transition-colors disabled:opacity-60 shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.7)]"
                >
                  {completing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {completing ? finishingLabel : m.inspection.finish}
                </motion.button>
              </div>
            )}
          </>
        )}
      </div>

      <BrandFooter />
    </div>
  );
}
