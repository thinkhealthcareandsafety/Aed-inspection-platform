'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Check, Loader2, MoreHorizontal, WifiOff } from 'lucide-react';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { scoreOf } from '@/lib/score';
import { ScoreCounter } from '@/components/inspection/ScoreCounter';
import { CHECKLIST_SECTIONS, QUICK_CHECK_IDS, REQUIRED_ITEM_IDS } from '@/lib/checklist-config';
import { deviceAge } from '@/lib/device-age';
import { QuickCheckpoint } from '@/components/public/QuickCheckpoint';
import { modelDisplayName, modelNameParts } from '@/lib/aed-models';
import { readingOf } from '@/lib/readings';
import { preloadReferenceImages } from '@/lib/reference-examples';
import { ActiveCheck, CheckRow } from '@/components/inspection/ActiveCheck';
import { ProgressRail } from '@/components/inspection/ProgressRail';
import { ContactForm, type ContactFormData } from '@/components/public/ContactForm';
import { ModelSelect } from '@/components/public/ModelSelect';
import { WelcomeStep, type InspectionPath } from '@/components/public/WelcomeStep';
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
import type { ChecklistItemId, ChecklistItemResult, Inspection, ReplacementRequest } from '@/types';

const loadInspectionMenu = () => import('@/components/public/InspectionMenu');
const InspectionMenu = dynamic(loadInspectionMenu, { ssr: false });

type Step = 'contact' | 'welcome' | 'model' | 'inspecting';

/**
 * Inspections are done on a phone, in a stairwell, often one-handed — tabs get
 * backgrounded and killed, and a stray refresh shouldn't cost someone eight
 * analysed photos. Only the id is kept locally: the inspection itself (photos,
 * verdicts, contact details) already lives on the server, so recovery is a
 * re-fetch rather than a client-side copy of someone's personal data.
 */
const ACTIVE_INSPECTION_KEY = 'aed_active_inspection';
/** The path picked on the welcome screen, so a refresh after the quick
 *  check doesn't stop someone who chose the full inspection at the fork. */
const ACTIVE_PATH_KEY = 'aed_active_path';
/** Past this, resuming is more confusing than helpful. */
const MAX_RESUME_AGE_MS = 24 * 60 * 60 * 1000;

function rememberInspection(id: string, path?: InspectionPath) {
  try {
    localStorage.setItem(ACTIVE_INSPECTION_KEY, id);
    // A path left by an earlier inspection on this device isn't this one's.
    if (path) localStorage.setItem(ACTIVE_PATH_KEY, path);
    else localStorage.removeItem(ACTIVE_PATH_KEY);
  } catch {
    // Private mode or storage disabled — resume just won't be available.
  }
}

function rememberedPath(): InspectionPath | null {
  try {
    const v = localStorage.getItem(ACTIVE_PATH_KEY);
    return v === 'quick' || v === 'full' ? v : null;
  } catch {
    return null;
  }
}

function forgetInspection() {
  try {
    localStorage.removeItem(ACTIVE_INSPECTION_KEY);
    localStorage.removeItem(ACTIVE_PATH_KEY);
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
  /** Chosen on the welcome screen; kept for every AED inspected this visit. */
  const [path, setPath] = useState<InspectionPath | null>(null);
  /** Past the quick-check fork: chosen there, or by picking the full
   *  inspection up front. The ref is what checkpointFor consults. */
  const [goFull, setGoFull] = useState(false);
  const goFullRef = useRef(false);
  const applyGoFull = useCallback((full: boolean) => {
    goFullRef.current = full;
    setGoFull(full);
  }, []);
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
        const restoredPath = rememberedPath();
        setPath(restoredPath);
        applyGoFull(restoredPath === 'full');
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
  }, [applyGoFull]);

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

  /** Every check answered: passed, failed, or — for the four a site may not
   *  have — "I don't have this". Only then is there a report to finish. */
  const allResolved = useMemo(
    () =>
      Boolean(inspection) &&
      ALL_ITEMS.every((i) => {
        const st = inspection?.checklist.find((c) => c.itemId === i.id)?.status;
        return st === 'pass' || st === 'fail' || st === 'skipped';
      }),
    [inspection, ALL_ITEMS],
  );

  /** Open the first outstanding check as soon as there's an inspection to
   *  work on — including after a refresh, which lands mid-list. All ten are
   *  one sequence: the last four each offer "I don't have this". */
  const firstOutstandingRequired = useMemo(() => {
    if (!inspection) return undefined;
    const outstanding = (id: string) => {
      const st = inspection.checklist.find((c) => c.itemId === id)?.status;
      return st === 'pending' || st === 'error';
    };
    return ALL_ITEMS.find((i) => outstanding(i.id))?.id;
  }, [inspection, ALL_ITEMS]);

  // Every example this model's checks will show, fetched while the first
  // check is being read — so the next one's photo is already on screen.
  const inspectionModel = inspection?.aedModel;
  useEffect(() => preloadReferenceImages(inspectionModel), [inspectionModel]);

  /**
   * The quick check — readiness indicator, then serial number — ends at a
   * fork: finish with a quick-check report, or carry on with the full
   * inspection. The fork stands while both are answered and nothing of the
   * full inspection has been started, so a refresh lands back on it.
   */
  const checkpointFor = useCallback(
    (insp: Inspection | null | undefined): boolean => {
      if (!insp || insp.inspectionStatus === 'complete' || goFullRef.current) return false;
      const statusOf = (id: string) => insp.checklist.find((c) => c.itemId === id)?.status;
      const quickDone = QUICK_CHECK_IDS.every((id) => statusOf(id) === 'pass' || statusOf(id) === 'fail');
      const fullStarted = ALL_ITEMS.some((i) => !QUICK_CHECK_IDS.includes(i.id) && statusOf(i.id) !== 'pending');
      return quickDone && !fullStarted;
    },
    [ALL_ITEMS],
  );
  // goFull is read for its re-render; the ref is what the check consults.
  const atCheckpoint = useMemo(() => checkpointFor(inspection), [checkpointFor, inspection, goFull]);

  const [openedOnce, setOpenedOnce] = useState(false);
  useEffect(() => {
    if (!inspection || openedOnce) return;
    setOpenedOnce(true);
    setActiveId(checkpointFor(inspection) ? null : (firstOutstandingRequired ?? null));
  }, [inspection, openedOnce, firstOutstandingRequired, checkpointFor]);

  /** Every check but the open one, in inspection order: the six required
   *  ones always (numbered, so the list reads as a route, not a pile), plus
   *  any optional extra already done. Items stay where they are as they get
   *  ticked off — they used to jump between "Still to do" and "Done". */
  const listed = useMemo(() => ({ checklist: inspection ? ALL_ITEMS : [] }), [inspection, ALL_ITEMS]);

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

  /** "Check 7 of 10": one sequence, every check counted. */
  const activePosition = useMemo(() => {
    if (!activeItem) return undefined;
    const index = ALL_ITEMS.findIndex((i) => i.id === activeItem.id);
    return index < 0 ? undefined : { index: index + 1, total: ALL_ITEMS.length };
  }, [activeItem, ALL_ITEMS]);

  /** Where moving on from the open check leads, said on its button — the
   *  same rule handleAdvance follows. */
  const nextLabel = useMemo(() => {
    const outstanding = (id: string) => {
      if (id === activeId) return false;
      const s = inspection?.checklist.find((c) => c.itemId === id)?.status;
      return s === 'pending' || s === 'error';
    };
    // The last quick check leads to the quick-check result, not a check.
    const quickLeft = QUICK_CHECK_IDS.some((id) => outstanding(id));
    const fullStarted = ALL_ITEMS.some(
      (i) => !QUICK_CHECK_IDS.includes(i.id) && inspection?.checklist.find((c) => c.itemId === i.id)?.status !== 'pending',
    );
    if (activeId && QUICK_CHECK_IDS.includes(activeId as ChecklistItemId) && !quickLeft && !fullStarted && !goFull) {
      return m.quick.next;
    }
    if (ALL_ITEMS.some((i) => outstanding(i.id))) return m.check.next.check;
    return m.check.next.finish;
  }, [inspection, activeId, ALL_ITEMS, goFull, m]);

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
    setStep('welcome');
    track('contact_submitted');
  }, []);

  const handleChoosePath = useCallback((chosen: InspectionPath) => {
    setPath(chosen);
    setStep('model');
    track('path_chosen', { outcome: chosen });
  }, []);

  const handleSelectModel = useCallback(
    async (aedModel: string) => {
      if (!contact || starting) return;
      setStarting(true);
      setPendingModel(aedModel);
      track('model_selected', { aedModel });
      try {
        const res = await api.public.createInspection({ ...contact, aedModel });
        rememberInspection(res.data.inspection.inspectionId, path ?? undefined);
        // Chose the full inspection up front: no stopping at the fork.
        applyGoFull(path === 'full');
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
    [contact, starting, path, applyGoFull, m],
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

  const handleComplete = useCallback(async (scope: 'quick' | 'full' = 'full') => {
    if (!inspection) return;
    setCompleting(true);
    try {
      const res = await api.public.complete(inspection.inspectionId, scope);
      setInspection(res.data.inspection);
      setEmailStatus(res.data.email);
      if (scope === 'quick') {
        track('quick_check_finished', {
          inspectionId: inspection.inspectionId,
          aedModel: inspection.aedModel,
          outcome: res.data.inspection.inspectionResult,
        });
      }
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
      // The quick check done: stop at the fork rather than run on.
      if (QUICK_CHECK_IDS.includes(doneId as ChecklistItemId) && checkpointFor(current)) {
        setActiveId(null);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      // On through all ten in order; the last four each offer "I don't
      // have this", so a site without a cabinet or kit loses one tap.
      const order: string[] = ALL_ITEMS.map((i) => i.id);
      const at = order.indexOf(doneId);
      const after = order.slice(at + 1).concat(order.slice(0, at));
      const next = after.find((id) => id !== doneId && outstanding(id)) ?? null;
      setActiveId(next);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [ALL_ITEMS, checkpointFor],
  );

  /** From the fork into the full inspection: straight to its first check. */
  const continueFull = useCallback(() => {
    applyGoFull(true);
    if (inspection) {
      track('full_inspection_chosen', { inspectionId: inspection.inspectionId, aedModel: inspection.aedModel });
    }
    const next = ALL_ITEMS.find((i) => {
      if (QUICK_CHECK_IDS.includes(i.id)) return false;
      const st = inspection?.checklist.find((c) => c.itemId === i.id)?.status;
      return st === 'pending' || st === 'error';
    });
    setActiveId(next?.id ?? null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [ALL_ITEMS, inspection, applyGoFull]);

  const openCheck = useCallback((id: string) => {
    setActiveId(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleReset = useCallback(() => {
    forgetInspection();
    setActiveId(null);
    setOpenedOnce(false);
    setStep('contact');
    setContact(null);
    setPath(null);
    applyGoFull(false);
    setInspection(null);
    setEmailStatus(null);
    window.scrollTo({ top: 0 });
  }, [applyGoFull]);

  /** A facilities manager rarely has one AED. The next one should cost a
   *  single tap on the model, not the whole contact form again. */
  const handleInspectAnother = useCallback(() => {
    forgetInspection();
    setActiveId(null);
    setOpenedOnce(false);
    // The next AED starts from its own quick check — or none, on the full
    // path; continuing past the last one's fork doesn't carry over.
    applyGoFull(false);
    setInspection(null);
    setEmailStatus(null);
    setStep(contact ? 'model' : 'contact');
    window.scrollTo({ top: 0 });
  }, [contact, applyGoFull]);

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
  }, [handleReset]);

  /** On a laptop, "Take the photo" opens a file browser. This link reopens
   *  the same inspection on a phone, where it opens the camera. */
  const handoffUrl =
    isDesktop && inspection && typeof window !== 'undefined'
      ? `${window.location.origin}/?resume=${inspection.inspectionId}${lang === 'hi' ? '&lang=hi' : ''}`
      : null;
  const openHandoff = useCallback(() => setMenu('phone'), []);

  // The welcome is the start of choosing what to inspect, not a step of its own.
  const stepIndex: 0 | 1 | 2 = step === 'contact' ? 0 : step === 'inspecting' ? 2 : 1;

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
  const readyToFinish = !isComplete && !activeItem && allResolved;

  const expiredKinds = expired.map((i) => (i.id === 'pads_expiry' ? ('pads' as const) : ('battery' as const)));
  const expiredSentence = expiredKinds.length ? m.inspection.ready.expired(expiredKinds) : '';
  const headerModel = modelNameParts(inspection?.aedModel);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {inspecting && inspection ? (
        // One bar for the whole job: which AED, how far along, and — from the
        // colour of each segment — which checks passed and which didn't.
        <header className="pin-when-tall sticky top-0 z-30 bg-background/85 backdrop-blur-xl border-b border-border/70">
          <div className="max-w-md w-full mx-auto px-4 py-3">
            <div className="flex items-center gap-2.5">
              {/* On the narrowest phones the brand gives way, so the model —
                  the part that tells a Lifeline VIEW from a Lifeline ECG —
                  is never the part cut off. */}
              <span className="text-headline text-foreground truncate min-w-0 flex-1">
                {headerModel.brand && <span className="max-[374px]:hidden">{headerModel.brand} </span>}
                {headerModel.name}
              </span>
              {/* The score, live: each check that passes adds its marks here
                  as it happens. How far along the job is, the rail shows. */}
              {/* Hidden at the quick-check fork: 40 of 100 beside "your AED
                  is ready" would read as a failing grade. The score is out of
                  all ten checks, and comes back with the full inspection. */}
              {!isComplete && !atCheckpoint && <ScoreCounter score={scoreOf(inspection.checklist)} />}
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
                  className="tap-target -mr-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <MoreHorizontal className="h-5 w-5" strokeWidth={2} />
                </button>
              )}
            </div>
            <ProgressRail
              className="mt-2.5"
              items={ALL_ITEMS}
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

        {/* Each screen starts at its top. The form is submitted from its
            foot, and a phone kept that scroll position into the next screen,
            opening it at the bottom. Reset once the old screen has gone, so
            it doesn't jump while it fades out. */}
        <AnimatePresence mode="wait" onExitComplete={() => window.scrollTo({ top: 0 })}>
          {resume === 'done' && step === 'contact' && (
            <ContactForm key="contact" defaultValues={contact ?? undefined} onSubmit={handleContactSubmit} />
          )}

          {resume === 'done' && step === 'welcome' && contact && (
            <WelcomeStep
              key="welcome"
              name={contact.name}
              email={contact.email}
              onChoose={handleChoosePath}
              onEditDetails={() => setStep('contact')}
            />
          )}

          {resume === 'done' && step === 'model' && (
            <ModelSelect
              key="model"
              selected={pendingModel}
              starting={starting}
              contact={contact}
              onSelect={handleSelectModel}
              onBack={() => setStep(contact ? 'welcome' : 'contact')}
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

            {atCheckpoint && !activeItem && (() => {
              const serialEntry = inspection.checklist.find((c) => c.itemId === 'serial_number');
              const serial =
                serialEntry?.status === 'pass' && typeof serialEntry.aiData?.serial_number === 'string'
                  ? serialEntry.aiData.serial_number
                  : null;
              return (
                <QuickCheckpoint
                  ready={inspection.checklist.find((c) => c.itemId === 'readiness_indicator')?.status === 'pass'}
                  serial={serial}
                  age={serial ? deviceAge(inspection.aedModel, serial, serialEntry?.aiData?.manufacture_date) : null}
                  remaining={ALL_ITEMS.length - QUICK_CHECK_IDS.length}
                  finishing={completing}
                  onFinish={() => void handleComplete('quick')}
                  onContinue={continueFull}
                />
              );
            })()}

            {/* Every check answered: say so, point at anything
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
                    ? m.inspection.ready.allDone(ALL_ITEMS.length)
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
                        className="pressable h-11 px-3.5 rounded-xl bg-secondary hover:bg-secondary/75 text-callout font-medium text-foreground transition-colors"
                      >
                        {m.inspection.ready.retake(m.items[item.id]?.title ?? item.title)}
                      </button>
                    ))}
                  </div>
                )}
              </motion.section>
            )}

            {listed.checklist.length > 0 && (
              <section>
                <div className="group-label">{m.inspection.checklist}</div>
                <div className="relative -mx-2">
                  {/* The line the dots sit on: 8px row padding + half a dot. */}
                  <span aria-hidden className="absolute left-5 top-6 bottom-6 w-px -translate-x-1/2 bg-border" />
                  {listed.checklist.map((item) => {
                    const result = inspection.checklist.find((c) => c.itemId === item.id);
                    if (!result) return null;
                    const index = ALL_ITEMS.findIndex((r) => r.id === item.id);
                    return (
                      <CheckRow
                        key={item.id}
                        item={item}
                        result={result}
                        index={index >= 0 ? index + 1 : undefined}
                        current={item.id === activeId}
                        onSelect={() => openCheck(item.id)}
                      />
                    );
                  })}
                </div>
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
                  onClick={() => void handleComplete('full')}
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
