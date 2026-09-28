'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { useElapsed } from '@/lib/use-elapsed';

export type AnalysisPhase = 'preparing' | 'uploading' | 'analyzing';

/** Typical time the server spends after the upload lands, measured against
 *  production: photos ~3-8s, video ~10-15s (frame extraction + model). */
const EXPECTED_ANALYSIS_MS = { image: 6_000, video: 14_000 } as const;

/** What the AI is reading, in the words of the check — "reading the serial
 *  number" tells someone the system understood what they photographed, which
 *  a generic "processing" never does. */
const READING_COPY: Record<string, string> = {
  serial_number: 'Reading the serial number',
  pads_expiry: 'Reading the pads expiry date',
  battery_expiry: 'Reading the battery expiry date',
  battery_attached: 'Checking the battery is seated',
  pads_connected: 'Checking the pads connector',
};

const SLOW = 'Taking a little longer than usual — hang on';

function stageText(
  itemId: string,
  mediaType: 'image' | 'video',
  phase: AnalysisPhase,
  uploadFraction: number,
  analysisElapsed: number,
): string {
  const noun = mediaType === 'video' ? 'video' : 'photo';
  if (phase === 'preparing') return `Preparing your ${noun}`;
  if (phase === 'uploading') return `Uploading your ${noun}… ${Math.round(uploadFraction * 100)}%`;

  // The analysis stages follow the server pipeline in order. Their timing is
  // estimated from typical durations; the order and the work are real.
  const r = analysisElapsed / EXPECTED_ANALYSIS_MS[mediaType];
  if (mediaType === 'video') {
    if (r < 0.25) return 'Pulling frames from the clip';
    if (r < 0.75) return 'Watching for the status light to blink';
    if (r < 1.3) return 'Confirming the result';
    return SLOW;
  }
  if (r < 0.5) return READING_COPY[itemId] ?? 'Looking at your photo';
  if (r < 1.3) return 'Checking it against the checklist';
  return SLOW;
}

/**
 * Bar position, 0-1. The upload stretch is measured and drawn as-is. The
 * analysis stretch can't be measured from here, so it eases toward — never
 * reaches — the end, and only completes when the result actually arrives. A
 * bar that sits at 100% while nothing has happened is worse than no bar.
 */
function barPosition(
  mediaType: 'image' | 'video',
  phase: AnalysisPhase,
  uploadFraction: number,
  analysisElapsed: number,
): number {
  if (phase === 'preparing') return 0.04;
  if (phase === 'uploading') return 0.06 + 0.29 * uploadFraction;
  const tau = EXPECTED_ANALYSIS_MS[mediaType] / 2;
  return 0.35 + 0.6 * (1 - Math.exp(-analysisElapsed / tau));
}

export function AnalysisProgress({
  itemId,
  mediaType,
  phase,
  uploadFraction,
  previewUrl,
  statusNote,
}: {
  itemId: string;
  mediaType: 'image' | 'video';
  phase: AnalysisPhase;
  uploadFraction: number;
  /** A local object URL of what was just captured. */
  previewUrl?: string;
  /** Overrides the stage text — e.g. "AI service is busy — retrying…". */
  statusNote?: string;
}) {
  const analysisElapsed = useElapsed(phase === 'analyzing');
  // A HEIC photo, or a codec the browser can't decode, fails to preview.
  // That's cosmetic: drop the preview rather than show a broken image.
  const [previewFailed, setPreviewFailed] = useState(false);

  const text = statusNote ?? stageText(itemId, mediaType, phase, uploadFraction, analysisElapsed);
  const position = barPosition(mediaType, phase, uploadFraction, analysisElapsed);
  const measurable = phase === 'uploading';

  return (
    <div className="mt-4">
      {previewUrl && !previewFailed && (
        <div className="relative w-full aspect-[4/3] rounded-xl overflow-hidden bg-secondary">
          {mediaType === 'video' ? (
            <video
              src={previewUrl}
              muted
              playsInline
              autoPlay
              loop
              onError={() => setPreviewFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Your capture, being analysed"
              onError={() => setPreviewFailed(true)}
              className="w-full h-full object-cover"
            />
          )}

          {/* A slow sweep over the capture: the machine is looking at the
              thing you gave it. Transform-only, so the app-wide reduced-motion
              setting holds it still for anyone who has asked for less motion. */}
          <div className="absolute inset-0 bg-black/15 pointer-events-none" />
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <motion.div
              className="absolute inset-x-0 top-0 h-[30%]"
              style={{
                background:
                  'linear-gradient(to bottom, transparent, hsl(var(--primary) / 0.35) 55%, hsl(var(--primary) / 0.7) 60%, transparent)',
              }}
              initial={{ y: '-100%' }}
              animate={{ y: '333%' }}
              transition={{ duration: 1.8, ease: 'linear', repeat: Infinity }}
            />
          </div>
        </div>
      )}

      <div
        className="mt-3 h-1.5 rounded-full bg-secondary overflow-hidden"
        role="progressbar"
        aria-label={text}
        aria-valuemin={0}
        aria-valuemax={100}
        // Only a measured value is announced as one. The analysis stretch is
        // an estimate, so it is left indeterminate for assistive tech.
        {...(measurable ? { 'aria-valuenow': Math.round(uploadFraction * 100) } : {})}
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
          style={{ width: `${Math.round(position * 100)}%` }}
        />
      </div>

      <div className="flex items-center gap-2 mt-2.5" role="status" aria-live="polite">
        <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
        <span className="text-callout text-foreground">{text}</span>
      </div>
      {mediaType === 'video' && phase === 'analyzing' && !statusNote && (
        <p className="text-footnote text-muted-foreground mt-1 pl-6">
          Video usually takes about 15 seconds. Keep this screen open.
        </p>
      )}
    </div>
  );
}
