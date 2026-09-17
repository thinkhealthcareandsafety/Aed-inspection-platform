'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { Camera, Video, Loader2, RotateCcw, SkipForward, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api, BASE_URL } from '@/lib/api';
import { compressImage } from '@/lib/compress-image';
import { springSnappy } from '@/lib/motion';
import { ChecklistIcon } from '@/components/icons';
import { ReferenceStrip } from './ReferenceStrip';
import type { ChecklistItemMeta } from '@/lib/checklist-config';
import type { ChecklistItemResult } from '@/types';

function extractApiError(err: unknown): { message?: string; retryable?: boolean } {
  if (axios.isAxiosError(err)) {
    const payload = err.response?.data?.error as { message?: string; retryable?: boolean } | undefined;
    return { message: payload?.message, retryable: payload?.retryable };
  }
  return {};
}

/** What the AI read off the photo, if it read anything worth showing back.
 *  Seeing "B17C-0051E" appear from a photo is the moment the product becomes
 *  believable, so it gets stated rather than buried in a confidence score. */
function readValue(result: ChecklistItemResult): string | null {
  const data = result.aiData as Record<string, unknown> | undefined;
  if (!data) return null;
  const serial = typeof data.serial_number === 'string' ? data.serial_number : null;
  if (serial) return serial;
  const expiry = typeof data.expiry_date === 'string' ? data.expiry_date : null;
  return expiry ? formatExpiry(expiry) : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The AI normalises expiries to 'YYYY-MM'. That's the right shape to store
 *  and the wrong one to show a human, so it reads as 'Mar 2027' on screen. */
function formatExpiry(raw: string): string {
  const full = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (full) return `${Number(full[3])} ${MONTHS[Number(full[2]) - 1]} ${full[1]}`;
  const month = /^(\d{4})-(\d{2})$/.exec(raw);
  if (month) return `${MONTHS[Number(month[2]) - 1]} ${month[1]}`;
  return raw;
}

interface Props {
  item: ChecklistItemMeta;
  result: ChecklistItemResult;
  /** 1-based position among required checks, for "Check 3 of 6". */
  position?: { index: number; total: number };
  inspectionId: string;
  aedModel?: string;
  onChange: (result: ChecklistItemResult) => void;
  onDone: (itemId: string) => void;
  uploadFn?: typeof api.checklist.upload;
  skipFn?: typeof api.checklist.skip;
}

/**
 * The one check the inspector is doing right now, expanded.
 *
 * The previous screen showed all ten at once — twenty identical buttons down
 * a two-thousand-pixel page, which reads as paperwork rather than a guided
 * task. Exactly one is open at a time now, with its reference photo already
 * on screen and a single obvious action.
 */
export function ActiveCheck({
  item,
  result,
  position,
  inspectionId,
  aedModel,
  onChange,
  onDone,
  uploadFn,
  skipFn,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const isBusy = busy || result.status === 'analyzing';
  const isResolved = result.status === 'pass' || result.status === 'fail';

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const upload = uploadFn ?? api.checklist.upload;
    setBusy(true);
    onChange({ ...result, status: 'analyzing' });

    try {
      const prepared = await compressImage(file);

      let res;
      try {
        res = await upload(inspectionId, item.id, prepared, prepared.name);
      } catch (err) {
        const { retryable } = extractApiError(err);
        if (!retryable) throw err;
        onChange({ ...result, status: 'analyzing', notes: 'AI service is busy — retrying…' });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        res = await upload(inspectionId, item.id, prepared, prepared.name);
      }

      onChange(res.data.item);
      // Hand the inspector straight to the next check — the pause between
      // "done" and "what now" is where people put the phone down.
      onDone(item.id);
    } catch (err) {
      const { message } = extractApiError(err);
      onChange({
        ...result,
        status: 'error',
        notes: message || 'Could not upload this photo — check your connection and try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSkip() {
    setBusy(true);
    try {
      const res = await (skipFn ?? api.checklist.skip)(inspectionId, item.id);
      onChange(res.data.item);
      onDone(item.id);
    } catch {
      // toast handled globally by the api client
    } finally {
      setBusy(false);
    }
  }

  const value = readValue(result);

  return (
    <motion.div
      layout="position"
      transition={springSnappy}
      className="surface-group p-5"
    >
      <div className="flex items-center gap-2">
        <ChecklistIcon
          name={item.icon}
          className="w-4 h-4 text-muted-foreground shrink-0"
          strokeWidth={1.9}
        />
        <span className="text-caption uppercase tracking-[0.06em] text-muted-foreground">
          {position ? `Check ${position.index} of ${position.total}` : 'Optional check'}
        </span>
      </div>

      <h2 className="text-title text-foreground mt-2.5">{item.title}</h2>
      <p className="text-body text-muted-foreground mt-1.5">{item.description}</p>

      <ReferenceStrip itemId={item.id} aedModel={aedModel} className="mt-4" />

      {/* The photo just taken, and what came back from it. */}
      {result.mediaUrl && isResolved && (
        <div className="mt-4 rounded-xl overflow-hidden bg-secondary">
          {result.mediaType === 'video' ? (
            <video src={`${BASE_URL}${result.mediaUrl}`} controls className="w-full max-h-52 object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${BASE_URL}${result.mediaUrl}`} alt={item.title} className="w-full max-h-52 object-contain" />
          )}
        </div>
      )}

      {isResolved && (
        <div
          className={cn(
            'mt-3 rounded-xl px-3.5 py-3 flex items-start gap-2.5',
            result.status === 'pass' ? 'bg-emerald-500/8' : 'bg-destructive/8',
          )}
        >
          {result.status === 'pass' ? (
            <CheckCircle2 className="w-4 h-4 mt-px shrink-0 text-emerald-600 dark:text-emerald-400" strokeWidth={2.2} />
          ) : (
            <AlertCircle className="w-4 h-4 mt-px shrink-0 text-destructive" strokeWidth={2.2} />
          )}
          <div className="min-w-0">
            {value && (
              <p className="text-headline font-mono text-foreground">{value}</p>
            )}
            <p
              className={cn(
                'text-footnote',
                value && 'mt-0.5',
                result.status === 'pass' ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive',
              )}
            >
              {result.notes}
            </p>
          </div>
        </div>
      )}

      {result.status === 'error' && result.notes && (
        <p className="mt-3 text-footnote text-destructive bg-destructive/8 rounded-xl px-3.5 py-3">
          {result.notes}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={item.mediaType === 'video' ? 'video/*' : 'image/*'}
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'pressable flex-1 flex items-center justify-center gap-2 h-[52px] rounded-2xl text-headline transition-colors',
            isResolved
              ? 'bg-secondary hover:bg-secondary/80 text-foreground'
              : 'bg-primary hover:bg-primary/92 text-primary-foreground',
            isBusy && 'opacity-60 pointer-events-none',
          )}
        >
          {isBusy ? (
            <Loader2 className="w-[18px] h-[18px] animate-spin" />
          ) : isResolved ? (
            <RotateCcw className="w-[18px] h-[18px]" strokeWidth={2} />
          ) : item.mediaType === 'video' ? (
            <Video className="w-[18px] h-[18px]" strokeWidth={2} />
          ) : (
            <Camera className="w-[18px] h-[18px]" strokeWidth={2} />
          )}
          {isBusy
            ? 'Reading the photo…'
            : isResolved
              ? 'Retake'
              : item.mediaType === 'video'
                ? 'Record the video'
                : 'Take the photo'}
        </button>

        {!item.required && !isResolved && (
          <button
            type="button"
            disabled={isBusy}
            onClick={handleSkip}
            className="pressable flex items-center justify-center gap-1.5 h-[52px] px-4 rounded-2xl bg-secondary/60 hover:bg-secondary text-callout text-muted-foreground hover:text-foreground transition-colors"
          >
            <SkipForward className="w-4 h-4" strokeWidth={2} />
            Skip
          </button>
        )}
      </div>

      {isResolved && (
        <button
          type="button"
          onClick={() => onDone(item.id)}
          className="pressable w-full flex items-center justify-center gap-1 h-10 mt-2 rounded-xl text-callout text-muted-foreground hover:text-foreground transition-colors"
        >
          Next check
          <ChevronRight className="w-4 h-4" strokeWidth={2.2} />
        </button>
      )}
    </motion.div>
  );
}

/**
 * A check that isn't the current one: one line, tappable to reopen. Keeps the
 * whole job visible without putting ten camera buttons on screen at once.
 */
export function CheckRow({
  item,
  result,
  onSelect,
}: {
  item: ChecklistItemMeta;
  result: ChecklistItemResult;
  onSelect: () => void;
}) {
  const value = readValue(result);
  const done = result.status === 'pass';
  const failed = result.status === 'fail' || result.status === 'error';
  const skipped = result.status === 'skipped';

  return (
    <button
      type="button"
      onClick={onSelect}
      className="surface-row w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-secondary/40 transition-colors"
    >
      <span className="shrink-0">
        {done ? (
          <span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center">
            <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={2.6} fill="none" />
          </span>
        ) : failed ? (
          <span className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center">
            <AlertCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.6} fill="none" />
          </span>
        ) : (
          <span
            className={cn(
              // block, not the default inline: an inline span ignores width
              // and height, which collapsed this circle into a hairline.
              'block w-5 h-5 rounded-full border-[1.5px]',
              skipped ? 'border-border' : 'border-muted-foreground/35',
            )}
          />
        )}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-callout text-foreground truncate">{item.title}</span>
        {(value || skipped) && (
          <span className="block text-caption text-muted-foreground font-mono truncate">
            {skipped ? 'Skipped' : value}
          </span>
        )}
      </span>

      <ChevronRight className="w-4 h-4 text-muted-foreground/50 shrink-0" strokeWidth={2} />
    </button>
  );
}
