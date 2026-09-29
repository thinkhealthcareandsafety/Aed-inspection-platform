'use client';

import { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  ChevronRight,
  Focus,
  Hand,
  Loader2,
  RotateCcw,
  SkipForward,
  Smartphone,
  SunDim,
  Timer,
  Video,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, BASE_URL } from '@/lib/api';
import { compressImage } from '@/lib/compress-image';
import { describeExpiry, urgencyOf } from '@/lib/expiry';
import { readingOf, type Reading } from '@/lib/readings';
import { URGENCY } from '@/lib/urgency';
import { EASE_OUT, springSnappy } from '@/lib/motion';
import { ChecklistIcon } from '@/components/icons';
import { ReferenceStrip } from './ReferenceStrip';
import { AnalysisProgress, type AnalysisPhase } from './AnalysisProgress';
import { StatusDot } from './StatusDot';
import type { ChecklistItemMeta } from '@/lib/checklist-config';
import type { ChecklistItemResult } from '@/types';

/** How long a fresh pass stays on screen before moving on by itself: long
 *  enough to read the value back, short enough that nobody reaches for a
 *  button. */
const AUTO_ADVANCE_MS = 2200;

function extractApiError(err: unknown): { message?: string; retryable?: boolean } {
  if (axios.isAxiosError(err)) {
    const payload = err.response?.data?.error as { message?: string; retryable?: boolean } | undefined;
    return { message: payload?.message, retryable: payload?.retryable };
  }
  return {};
}

/** A tap of feedback in the hand when a verdict lands — the person is
 *  looking at the AED, not the screen. Android only; iOS ignores it. */
function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported or blocked: silence is fine.
  }
}

/**
 * Whether a `sticky bottom-0` bar is currently stuck to the viewport rather
 * than resting in place, read from a sentinel placed right after it. Lets
 * the bar drop its rounded corners and gain a shadow only while it floats.
 */
function useStuckToBottom() {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) => {
      setStuck(!entry.isIntersecting && entry.boundingClientRect.top > 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, stuck] as const;
}

/** The three things that decide whether the AI can read a capture — said
 *  before the shutter, where they're cheap, instead of after a failed read. */
const CAPTURE_TIPS: Record<'image' | 'video', { icon: LucideIcon; label: string }[]> = {
  image: [
    { icon: Focus, label: 'Fill the frame' },
    { icon: SunDim, label: 'Avoid glare' },
    { icon: Hand, label: 'Hold steady' },
  ],
  video: [
    { icon: Timer, label: '10+ seconds' },
    { icon: Hand, label: 'Hold steady' },
    { icon: Focus, label: 'Light in frame' },
  ],
};

/** An expired date is the one fault a retake can't fix — the way forward is
 *  a replacement, which the result screen offers a quote for. */
const EXPIRED_GUIDANCE: Partial<Record<string, string>> = {
  pads_expiry: "Expired pads can't be fixed on the spot. Carry on — you can ask us for a replacement quote when you finish.",
  battery_expiry: "An expired battery can't be fixed on the spot. Carry on — you can ask us for a replacement quote when you finish.",
};

const PRIMARY_BUTTON =
  'pressable relative overflow-hidden flex-1 flex items-center justify-center gap-2 h-[52px] rounded-2xl bg-primary text-primary-foreground text-headline hover:bg-primary/92 transition-colors disabled:opacity-60';
const SECONDARY_BUTTON =
  'pressable flex items-center justify-center gap-1.5 h-[52px] px-4 rounded-2xl bg-secondary text-foreground text-callout font-medium hover:bg-secondary/75 transition-colors disabled:opacity-60';

interface Props {
  item: ChecklistItemMeta;
  result: ChecklistItemResult;
  /** 1-based position among required checks, for "Check 3 of 6". */
  position?: { index: number; total: number };
  inspectionId: string;
  aedModel?: string;
  /** What moving on leads to — "Next check", or the finish screen. */
  nextLabel?: string;
  onChange: (result: ChecklistItemResult) => void;
  onDone: (itemId: string) => void;
  uploadFn?: typeof api.checklist.upload;
  skipFn?: typeof api.checklist.skip;
  /** Given on a computer, where the capture button opens a file browser:
   *  offers to carry the inspection over to a phone's camera. */
  onContinueOnPhone?: () => void;
}

/**
 * The one check the inspector is doing right now, expanded.
 *
 * Three faces: what to capture (with the example already on screen), the
 * capture being read, and what came back. The result used to be skipped
 * entirely — the card moved on the instant the AI answered, so the serial
 * number it had just read off the label was never seen. A pass now holds for
 * a beat with the reading laid over the photo, then moves on by itself; a
 * failure stops and says what to do about it.
 */
export function ActiveCheck({
  item,
  result,
  position,
  inspectionId,
  aedModel,
  nextLabel = 'Next check',
  onChange,
  onDone,
  uploadFn,
  skipFn,
  onContinueOnPhone,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Each new check takes focus, so a screen reader announces it instead of
  // leaving the reader stranded on the button of the check that just ended.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  const [busy, setBusy] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [phase, setPhase] = useState<AnalysisPhase>('preparing');
  const [uploadFraction, setUploadFraction] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [retryNote, setRetryNote] = useState<string>();
  /** The verdict arrived in this card just now, as opposed to a finished
   *  check reopened from the list — only a fresh verdict animates in. */
  const [fresh, setFresh] = useState(false);
  /** Armed by a fresh pass; any touch on the card disarms it, because
   *  someone who has started interacting is in control now. */
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [sentinelRef, stuck] = useStuckToBottom();

  // Only THIS tab's own in-flight upload makes the card busy. A status of
  // 'analyzing' read back from the server can be stale — a tab closed
  // mid-upload leaves it behind — and treating that as busy used to lock the
  // check with a disabled button and no way to retake.
  const isResolved = result.status === 'pass' || result.status === 'fail';
  const mode: 'capture' | 'busy' | 'result' = busy ? 'busy' : isResolved ? 'result' : 'capture';
  const advancing = autoAdvance && result.status === 'pass' && !busy;

  // Object URLs hold the capture in memory until released.
  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!advancing) return;
    const id = setTimeout(() => onDone(item.id), AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [advancing, onDone, item.id]);

  function openCamera() {
    // Disarm first: the camera app can take longer than the countdown, and
    // advancing underneath it would unmount the input the photo returns to.
    setAutoAdvance(false);
    inputRef.current?.click();
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const upload = uploadFn ?? api.checklist.upload;
    setBusy(true);
    setFresh(false);
    setAutoAdvance(false);
    setRetryNote(undefined);
    setUploadFraction(0);
    setPhase('preparing');
    try {
      setPreviewUrl(URL.createObjectURL(file));
    } catch {
      setPreviewUrl(undefined);
    }
    onChange({ ...result, status: 'analyzing' });

    // Real progress while bytes are moving; once they've all landed, the wait
    // that remains is the server's, so the loader moves on to say so.
    const onProgress = (fraction: number) => {
      setUploadFraction(fraction);
      if (fraction >= 1) setPhase('analyzing');
    };

    // Should a browser never report upload progress, don't sit on
    // "Uploading… 0%" for the whole wait — move on to the analysis stages.
    let sawProgress = false;
    const trackedProgress = (fraction: number) => {
      sawProgress = true;
      onProgress(fraction);
    };
    const fallback = setTimeout(() => {
      if (!sawProgress) setPhase('analyzing');
    }, 2500);

    try {
      const prepared = await compressImage(file);
      setPhase('uploading');

      let res;
      try {
        res = await upload(inspectionId, item.id, prepared, prepared.name, trackedProgress);
      } catch (err) {
        const { retryable } = extractApiError(err);
        if (!retryable) throw err;
        setRetryNote('The AI service is busy — trying again…');
        onChange({ ...result, status: 'analyzing', notes: 'AI service is busy — retrying…' });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setRetryNote(undefined);
        setUploadFraction(0);
        setPhase('uploading');
        res = await upload(inspectionId, item.id, prepared, prepared.name, trackedProgress);
      }

      const verdict = res.data.item;
      onChange(verdict);
      setFresh(true);
      setAutoAdvance(verdict.status === 'pass');
      haptic(verdict.status === 'pass' ? 18 : [30, 60, 30]);
    } catch (err) {
      const { message } = extractApiError(err);
      setPreviewUrl(undefined);
      onChange({
        ...result,
        status: 'error',
        notes:
          message ||
          `Could not upload this ${item.mediaType === 'video' ? 'video' : 'photo'} — check your connection and try again.`,
      });
    } finally {
      clearTimeout(fallback);
      setBusy(false);
      setRetryNote(undefined);
    }
  }

  // Skipping has its own flag: it is a quick save, not an analysis, and must
  // not bring up the "reading your photo" loader.
  async function handleSkip() {
    setSkipping(true);
    try {
      const res = await (skipFn ?? api.checklist.skip)(inspectionId, item.id);
      onChange(res.data.item);
      onDone(item.id);
    } catch {
      // toast handled globally by the api client
    } finally {
      setSkipping(false);
    }
  }

  const reading = readingOf(result);
  const expired = Boolean(reading?.expiry && reading.expiry.days < 0);
  const expiredGuidance = expired ? EXPIRED_GUIDANCE[item.id] : undefined;
  const serverMedia = result.mediaUrl ? `${BASE_URL}${result.mediaUrl}` : undefined;
  const isVideo = item.mediaType === 'video';

  return (
    <motion.section
      initial={{ opacity: 0, x: 18 }}
      animate={{ opacity: 1, x: 0 }}
      transition={springSnappy}
      className="surface-card"
      aria-labelledby={`check-${item.id}`}
      onPointerDown={() => advancing && setAutoAdvance(false)}
    >
      <div className="px-5 pt-5">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0">
            <ChecklistIcon name={item.icon} className="w-4 h-4 text-foreground/70" strokeWidth={1.9} />
          </span>
          <span className="text-caption uppercase tracking-[0.06em] text-muted-foreground">
            {position ? `Check ${position.index} of ${position.total}` : 'Optional extra'}
          </span>
          {isVideo && (
            <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-caption text-muted-foreground">
              <Video className="w-3 h-3" strokeWidth={2.2} />
              Video
            </span>
          )}
        </div>

        <h2
          ref={headingRef}
          id={`check-${item.id}`}
          tabIndex={-1}
          className="text-title text-foreground mt-3 outline-none"
        >
          {item.title}
        </h2>

        {mode === 'capture' && (
          <>
            <p className="text-body text-muted-foreground mt-1">{item.description}</p>
            <ReferenceStrip itemId={item.id} aedModel={aedModel} className="mt-4" />
            <ul className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-secondary/60 px-3 py-2">
              {CAPTURE_TIPS[item.mediaType].map((tip) => (
                <li key={tip.label} className="flex items-center gap-1.5 text-caption text-muted-foreground">
                  <tip.icon className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
                  {tip.label}
                </li>
              ))}
            </ul>
            {result.status === 'error' && result.notes && (
              <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl bg-destructive/8 px-3.5 py-3">
                <AlertCircle className="w-4 h-4 mt-px shrink-0 text-destructive" strokeWidth={2.2} />
                <p className="text-footnote text-destructive">{result.notes}</p>
              </div>
            )}
          </>
        )}

        {/* While analysing, the example photo gives way to the person's own
            capture: the loader shows what is being looked at, not what to aim at. */}
        {mode === 'busy' && (
          <AnalysisProgress
            itemId={item.id}
            mediaType={item.mediaType}
            phase={phase}
            uploadFraction={uploadFraction}
            previewUrl={previewUrl}
            statusNote={retryNote}
          />
        )}

        {mode === 'result' && (
          <ResultView
            passed={result.status === 'pass'}
            fresh={fresh}
            isVideo={isVideo}
            title={item.title}
            sources={[previewUrl, serverMedia].filter((s): s is string => Boolean(s))}
            reading={reading}
            notes={result.notes}
            guidance={
              result.status === 'pass'
                ? undefined
                : (expiredGuidance ??
                  'Fix it if you can, then retake. Or carry on — it will be flagged in your report.')
            }
          />
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={isVideo ? 'video/*' : 'image/*'}
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {/* The action rides the bottom of the screen while this card is in
          view, so it is under the thumb even when the example photo and
          instructions push it below the fold. */}
      {mode === 'busy' ? (
        <div className="h-5" />
      ) : (
        <div
          className={cn(
            'sticky bottom-0 z-10 bg-card px-5 pt-4 pb-5 rounded-b-3xl',
            stuck &&
              'rounded-none pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[0_-1px_0_hsl(var(--border)),0_-14px_28px_-18px_rgb(0_0_0/0.35)]',
          )}
        >
          {/* Secondary on the left, the one filled button on the right —
              the same place in every state, so the thumb learns it once. */}
          {mode === 'capture' && (
            <div className="flex items-center gap-2">
              {!item.required && (
                <button type="button" disabled={skipping} onClick={handleSkip} className={SECONDARY_BUTTON}>
                  {skipping ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <SkipForward className="w-4 h-4" strokeWidth={2} />
                  )}
                  Skip
                </button>
              )}
              <button type="button" disabled={skipping} onClick={openCamera} className={PRIMARY_BUTTON}>
                {isVideo ? (
                  <Video className="w-[18px] h-[18px]" strokeWidth={2} />
                ) : (
                  <Camera className="w-[18px] h-[18px]" strokeWidth={2} />
                )}
                {result.status === 'error' ? 'Try again' : isVideo ? 'Record the video' : 'Take the photo'}
              </button>
            </div>
          )}
          {mode === 'capture' && onContinueOnPhone && (
            <button
              type="button"
              onClick={onContinueOnPhone}
              className="mx-auto mt-2 flex h-10 items-center gap-1.5 px-3 text-callout text-muted-foreground transition-colors hover:text-foreground"
            >
              <Smartphone className="h-4 w-4" strokeWidth={2} />
              On a computer? <span className="font-semibold text-primary">Continue on your phone</span>
            </button>
          )}

          {mode === 'result' && result.status === 'pass' && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={openCamera} className={SECONDARY_BUTTON} aria-label="Retake">
                <RotateCcw className="w-4 h-4" strokeWidth={2} />
                Retake
              </button>
              <button type="button" onClick={() => onDone(item.id)} className={PRIMARY_BUTTON}>
                {advancing && (
                  <motion.span
                    aria-hidden
                    className="absolute inset-y-0 left-0 bg-white/20 dark:bg-black/15"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: AUTO_ADVANCE_MS / 1000, ease: 'linear' }}
                  />
                )}
                <span className="relative flex items-center gap-2">
                  {nextLabel}
                  <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.2} />
                </span>
              </button>
            </div>
          )}

          {/* A real expiry can't be retaken away, so carrying on leads; any
              other fault is usually fixable on the spot, so retaking leads. */}
          {mode === 'result' && result.status === 'fail' && (
            <div className={cn('flex items-center gap-2', !expired && 'flex-row-reverse')}>
              <button
                type="button"
                onClick={openCamera}
                className={expired ? SECONDARY_BUTTON : PRIMARY_BUTTON}
              >
                {isVideo ? (
                  <Video className="w-[18px] h-[18px]" strokeWidth={2} />
                ) : (
                  <Camera className="w-[18px] h-[18px]" strokeWidth={2} />
                )}
                Retake
              </button>
              <button
                type="button"
                onClick={() => onDone(item.id)}
                className={expired ? PRIMARY_BUTTON : SECONDARY_BUTTON}
              >
                {expired ? nextLabel : 'Carry on'}
                <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
              </button>
            </div>
          )}
        </div>
      )}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-px" />
    </motion.section>
  );
}

/** The capture with its verdict and reading laid over it — the moment the
 *  AI proves it read the label. */
function ResultView({
  passed,
  fresh,
  isVideo,
  title,
  sources,
  reading,
  notes,
  guidance,
}: {
  passed: boolean;
  fresh: boolean;
  isVideo: boolean;
  title: string;
  /** The local capture first (instant), then the stored copy. */
  sources: string[];
  reading: Reading | null;
  notes?: string;
  guidance?: string;
}) {
  // A HEIC photo or an unplayable codec fails to render. Fall back to the
  // stored copy, then to no picture at all — the verdict carries it alone.
  const [sourceIndex, setSourceIndex] = useState(0);
  const src = sources[sourceIndex];
  const onError = () => setSourceIndex((i) => i + 1);
  const urgency = reading?.expiry ? URGENCY[urgencyOf(reading.expiry.days)] : undefined;
  const UrgencyIcon = urgency?.icon;

  const readingBlock = reading && (
    <motion.div
      initial={fresh ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springSnappy, delay: fresh ? 0.28 : 0 }}
    >
      <p className="text-caption uppercase tracking-[0.08em] opacity-75">{reading.label}</p>
      <p className={cn('text-display mt-0.5 break-all', reading.mono && 'font-mono tracking-normal')}>
        {reading.value}
      </p>
    </motion.div>
  );

  return (
    <div className="mt-4" role="status" aria-live="polite">
      {src ? (
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-secondary">
          {isVideo ? (
            <video src={src} muted playsInline autoPlay loop onError={onError} className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={`Your photo: ${title}`} onError={onError} className="w-full h-full object-cover" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-black/0 pointer-events-none" />
          <Verdict passed={passed} fresh={fresh} className="absolute top-3 left-3" />
          {readingBlock && <div className="absolute inset-x-4 bottom-3.5 text-white">{readingBlock}</div>}
        </div>
      ) : (
        <div
          className={cn(
            'rounded-2xl px-4 py-4',
            passed ? 'bg-emerald-500/10' : 'bg-destructive/8',
          )}
        >
          <Verdict passed={passed} fresh={fresh} />
          {readingBlock && <div className="mt-3 text-foreground">{readingBlock}</div>}
        </div>
      )}

      {reading?.expiry && urgency && UrgencyIcon && (
        <p
          className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-callout font-medium text-foreground"
          style={{ backgroundColor: urgency.tint }}
        >
          <UrgencyIcon className="w-4 h-4" strokeWidth={2.1} style={{ color: urgency.color }} />
          {describeExpiry(reading.expiry.days)}
        </p>
      )}

      {notes && <p className="mt-3 text-callout text-muted-foreground">{notes}</p>}
      {guidance && <p className="mt-2 text-footnote text-foreground/80">{guidance}</p>}
    </div>
  );
}

function Verdict({ passed, fresh, className }: { passed: boolean; fresh: boolean; className?: string }) {
  return (
    <motion.span
      initial={fresh ? { scale: 0.6, opacity: 0 } : false}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 26 }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full py-1 pl-1 pr-3 text-callout font-semibold shadow-sm',
        passed ? 'bg-emerald-600 text-white' : 'bg-destructive text-destructive-foreground',
        className,
      )}
    >
      <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
        {passed ? (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <motion.path
              d="M5 12.5l4.5 4.5L19 7.5"
              initial={{ pathLength: fresh ? 0 : 1 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.35, delay: 0.15, ease: EASE_OUT }}
            />
          </svg>
        ) : (
          <span className="text-[14px] font-bold leading-none">!</span>
        )}
      </span>
      {passed ? 'Passed' : 'Needs attention'}
    </motion.span>
  );
}

/**
 * A check that isn't the current one: one line, tappable to reopen. Keeps the
 * whole job visible without putting ten camera buttons on screen at once.
 */
export function CheckRow({
  item,
  result,
  index,
  onSelect,
}: {
  item: ChecklistItemMeta;
  result: ChecklistItemResult;
  /** Position among required checks, shown while it is still to do. */
  index?: number;
  onSelect: () => void;
}) {
  const reading = readingOf(result);
  const failed = result.status === 'fail' || result.status === 'error';
  const detail =
    result.status === 'skipped'
      ? 'Skipped'
      : reading
        ? reading.expiry
          ? `${reading.value} · ${describeExpiry(reading.expiry.days)}`
          : reading.value
        : result.status === 'error'
          ? 'Didn’t upload — tap to try again'
          : result.status === 'fail'
            ? 'Needs attention'
            : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      className="surface-row w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-secondary/40 transition-colors"
    >
      <StatusDot status={result.status} index={index} />
      <span className="min-w-0 flex-1">
        <span className="block text-callout text-foreground truncate">{item.title}</span>
        {detail && (
          <span
            className={cn(
              'block text-caption truncate mt-0.5',
              failed ? 'text-destructive' : 'text-muted-foreground',
              reading?.mono && 'font-mono',
            )}
          >
            {detail}
          </span>
        )}
      </span>
      <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" strokeWidth={2} />
    </button>
  );
}
