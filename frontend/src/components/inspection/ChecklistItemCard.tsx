'use client';

import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import { Camera, Video, CheckCircle2, XCircle, Loader2, SkipForward, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { api, BASE_URL } from '@/lib/api';
import { ChecklistIcon } from '@/components/icons';
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
}

const STATUS_STYLES: Record<string, string> = {
  pending: 'border-border/50 bg-card/40',
  analyzing: 'border-primary/40 bg-primary/5',
  pass: 'border-emerald-500/40 bg-emerald-500/5',
  fail: 'border-destructive/40 bg-destructive/5',
  skipped: 'border-border/30 bg-muted/20 opacity-70',
  error: 'border-destructive/40 bg-destructive/5',
  uploaded: 'border-primary/40 bg-primary/5',
};

export function ChecklistItemCard({ item, result, inspectionId, onChange, uploadFn, skipFn }: Props) {
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
      let res;
      try {
        res = await upload(inspectionId, item.id, file, file.name);
      } catch (err) {
        const { retryable } = extractApiError(err);
        if (!retryable) throw err;
        // Transient upstream blip (the AI service under load) — worth one
        // silent retry before bothering the inspector with an error.
        onChange({ ...result, status: 'analyzing', notes: 'AI service is busy — retrying…' });
        await new Promise((resolve) => setTimeout(resolve, 1500));
        res = await upload(inspectionId, item.id, file, file.name);
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
    <motion.div
      layout
      className={cn('rounded-xl border p-4 flex flex-col gap-3 transition-colors', STATUS_STYLES[result.status])}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-secondary/70 text-muted-foreground flex items-center justify-center shrink-0 mt-0.5">
            <ChecklistIcon name={item.icon} className="w-[18px] h-[18px]" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-semibold text-sm truncate">{item.title}</h4>
              {!item.required && (
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground bg-secondary/60 px-1.5 py-0.5 rounded">
                  optional
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            <div className="mt-1.5">
              <ReferenceExample itemId={item.id} itemTitle={item.title} />
            </div>
          </div>
        </div>
        <StatusBadge status={result.status} />
      </div>

      {result.mediaUrl && (
        <div className="rounded-lg overflow-hidden border border-border/40 bg-black/20 max-h-40">
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
            'text-xs rounded-md px-2 py-1.5',
            result.status === 'pass' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-destructive/10 text-destructive',
          )}
        >
          {result.notes}
          {typeof result.confidence === 'number' && (
            <span className="opacity-70"> · {Math.round(result.confidence * 100)}% confidence</span>
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
            'flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors',
            isDone
              ? 'bg-secondary/60 hover:bg-secondary text-foreground'
              : 'bg-primary hover:bg-primary/90 text-primary-foreground',
            isBusy && 'opacity-60 pointer-events-none',
          )}
        >
          {isBusy ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : isDone ? (
            <RotateCcw className="w-3.5 h-3.5" />
          ) : item.mediaType === 'video' ? (
            <Video className="w-3.5 h-3.5" />
          ) : (
            <Camera className="w-3.5 h-3.5" />
          )}
          {isBusy
            ? 'Analyzing…'
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
            className="flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-foreground border border-border/50 hover:bg-secondary/40 transition-colors"
          >
            <SkipForward className="w-3.5 h-3.5" />
            Skip
          </button>
        )}
      </div>
    </motion.div>
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
