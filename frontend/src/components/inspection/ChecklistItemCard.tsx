'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { Camera, Video, CheckCircle2, XCircle, Loader2, SkipForward, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { api, BASE_URL } from '@/lib/api';
import { ChecklistIcon } from '@/components/icons';
import { compressImage } from '@/lib/compress-image';
import { ReferenceExample } from './ReferenceExample';
import type { ChecklistItemMeta } from '@/lib/checklist-config';
import type { ChecklistItemResult } from '@/types';

/** Pulls the backend's structured error out of a failed request — the real
 *  reason (and whether it's worth retrying), not a generic fallback string. */
function extractApiError(err: unknown): { message?: string; retryable?: boolean } {
  if (axios.isAxiosError(err)) {
    const payload = err.response?.data?.error as { message?: string; retryable?: boolean } | undefined;
    return { message: payload?.message, retryable: payload?.retryable };
  }
  return {};
}

interface Props {
  item: ChecklistItemMeta;
  result: ChecklistItemResult;
  inspectionId: string;
  onChange: (result: ChecklistItemResult) => void;
  /** Override the upload/skip calls — used by the public (unauthenticated) inspection wizard. */
  uploadFn?: typeof api.checklist.upload;
  skipFn?: typeof api.checklist.skip;
  /** Narrows the reference example photo to the actual unit being inspected. */
  aedModel?: string;
  /** The one item the inspector should do next — gets the filled button so
   *  there's a single obvious focal point rather than ten competing ones. */
  isNext?: boolean;
}

export function ChecklistItemCard({
  item,
  result,
  inspectionId,
  onChange,
  uploadFn,
  skipFn,
  aedModel,
  isNext,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const isBusy = busy || result.status === 'analyzing';
  const isDone = result.status === 'pass' || result.status === 'fail' || result.status === 'skipped';

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const upload = uploadFn ?? api.checklist.upload;

    setBusy(true);
    onChange({ ...result, status: 'analyzing' });
    try {
      // Shrink before sending — field connections are the bottleneck, not the
      // AI. Falls back to the original file if anything goes wrong.
      const prepared = await compressImage(file);

      let res;
      try {
        res = await upload(inspectionId, item.id, prepared, prepared.name);
      } catch (err) {
        const { retryable } = extractApiError(err);
        if (!retryable) throw err;
        // Transient upstream blip (the AI service under load) — worth one
        // silent retry before bothering the inspector with an error.
        onChange({ ...result, status: 'analyzing', notes: 'AI service is busy — retrying…' });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        res = await upload(inspectionId, item.id, prepared, prepared.name);
      }
      onChange(res.data.item);
      if (res.data.item.status === 'pass') {
        toast.success(`${item.title}: passed`);
      } else if (res.data.item.status === 'fail') {
        toast.error(`${item.title}: needs attention`);
      }
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
    } catch {
      // toast handled globally by api client
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="surface-row px-4 py-3.5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <ChecklistIcon
          name={item.icon}
          className="w-[18px] h-[18px] text-muted-foreground/70 shrink-0 mt-[3px]"
          strokeWidth={1.7}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <h4 className="text-headline text-foreground truncate">{item.title}</h4>
            {!item.required && <span className="text-caption text-muted-foreground/70 shrink-0">Optional</span>}
          </div>
          <p className="text-footnote text-muted-foreground mt-0.5">{item.description}</p>
          <div className="mt-1.5">
            <ReferenceExample itemId={item.id} itemTitle={item.title} aedModel={aedModel} />
          </div>
        </div>
        <StatusBadge status={result.status} />
      </div>

      {result.mediaUrl && (
        <div className="rounded-xl overflow-hidden bg-secondary max-h-40">
          {result.mediaType === 'video' ? (
            <video src={`${BASE_URL}${result.mediaUrl}`} controls className="w-full max-h-40 object-contain" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`${BASE_URL}${result.mediaUrl}`}
              alt={item.title}
              className="w-full max-h-40 object-contain"
            />
          )}
        </div>
      )}

      {result.notes && (result.status === 'fail' || result.status === 'error' || result.status === 'pass') && (
        <p
          className={cn(
            'text-footnote rounded-xl px-3 py-2',
            result.status === 'pass'
              ? 'bg-emerald-500/8 text-emerald-700 dark:text-emerald-400'
              : 'bg-destructive/8 text-destructive',
          )}
        >
          {result.notes}
          {typeof result.confidence === 'number' && (
            <span className="opacity-60"> · {Math.round(result.confidence * 100)}% confidence</span>
          )}
        </p>
      )}

      <div className="flex items-center gap-2 mt-auto">
        <input
          ref={inputRef}
          type="file"
          accept={item.mediaType === 'video' ? 'video/*' : 'image/*'}
          capture="environment"
          className="hidden"
          onChange={handleFile}
        />
        <button
          type="button"
          disabled={isBusy}
          onClick={() => inputRef.current?.click()}
          className={cn(
            'pressable flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl text-callout font-medium transition-colors',
            isNext && !isDone
              ? 'bg-primary hover:bg-primary/92 text-primary-foreground'
              : 'bg-secondary hover:bg-secondary/80 text-foreground',
            isBusy && 'opacity-60 pointer-events-none',
          )}
        >
          {isBusy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isDone ? (
            <RotateCcw className="w-4 h-4" strokeWidth={2} />
          ) : item.mediaType === 'video' ? (
            <Video className="w-4 h-4" strokeWidth={2} />
          ) : (
            <Camera className="w-4 h-4" strokeWidth={2} />
          )}
          {isBusy
            ? 'Analysing…'
            : isDone
              ? 'Retake'
              : item.mediaType === 'video'
                ? 'Record video'
                : 'Capture photo'}
        </button>

        {!item.required && result.status === 'pending' && (
          <button
            type="button"
            disabled={isBusy}
            onClick={handleSkip}
            className="pressable flex items-center justify-center gap-1 h-11 px-4 rounded-xl text-callout text-muted-foreground hover:text-foreground bg-secondary/60 hover:bg-secondary transition-colors"
          >
            <SkipForward className="w-4 h-4" strokeWidth={2} />
            Skip
          </button>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: ChecklistItemResult['status'] }) {
  switch (status) {
    case 'pass':
      return (
        <span className="w-5 h-5 rounded-full bg-emerald-600 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-white" strokeWidth={2.5} fill="none" />
        </span>
      );
    case 'fail':
    case 'error':
      return (
        <span className="w-5 h-5 rounded-full bg-destructive flex items-center justify-center shrink-0">
          <XCircle className="w-3.5 h-3.5 text-white" strokeWidth={2.5} fill="none" />
        </span>
      );
    case 'analyzing':
    case 'uploaded':
      return <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />;
    default:
      return null;
  }
}
