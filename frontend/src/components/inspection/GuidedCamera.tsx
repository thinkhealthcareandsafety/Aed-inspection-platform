'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Camera, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { readinessSeconds, readinessSignal } from '@/lib/aed-models';
import { captionOf, getReferenceExamples } from '@/lib/reference-examples';
import { ReadinessDetector, type DetectorReport } from '@/lib/readiness-detector';
import {
  RECORDING_BITRATE,
  cameraFailureOf,
  keepScreenOn,
  openBackCamera,
  recorderMimeType,
  recordingFile,
  stopStream,
  type CameraFailure,
} from '@/lib/camera-recorder';
import { useBackToClose } from '@/lib/use-back-to-close';
import { useI18n } from '@/i18n';

/** Side, in pixels, of the patch inside the circle the detector reads. */
const PATCH = 80;
/** The circle's diameter, as a share of the picture's shorter side. */
const RING_FRACTION = 0.42;
/** Blinks on the clip before it stops by itself: the server wants one, two
 *  leaves no doubt. */
const NEED_BLINKS = 2;
/** Never shorter than this, whatever has been seen. */
const MIN_RECORD_MS = 3000;
/** Kept rolling this long after the last blink, so the clip shows it go dark. */
const AFTER_LAST_BLINK_MS = 900;
/** A blink counts towards the clip only this long after recording began:
 *  the recorder takes a moment to start, and the server needs to see the
 *  light dark before a blink to accept it. */
const CLIP_LEAD_MS = 700;
/** A blinking unit is given this many seconds past its usual time to blink. */
const EXTRA_BLINK_SECONDS = 8;

type Stage = 'starting' | 'live' | 'recording' | 'failed';

type FrameVideo = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };

function haptic(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Unsupported: silence is fine.
  }
}

interface Props {
  aedModel?: string;
  /** The finished clip, with the blinks the phone saw on it. */
  onCapture: (file: File, blinks: number) => void;
  onClose: () => void;
  /** The phone's own camera app instead — called from a tap, so the file
   *  picker it opens is allowed to open. */
  onUseCameraApp: () => void;
}

/**
 * The readiness clip, filmed inside the app so the person can be shown where
 * the light is and told, live, whether the phone can see it.
 *
 * A circle marks where the light goes; the unit's own photo, with the light
 * ringed, sits in the corner. The phone watches the circle for blinks
 * (lib/readiness-detector) and says what it sees — too dark, glare, hold
 * still, light found. Recording stops by itself once two blinks are on it
 * (or, for a unit that shows a steady symbol, after its usual time), so the
 * clip is never too short to judge or longer than it needs to be.
 */
export function GuidedCamera({ aedModel, onCapture, onClose, onUseCameraApp }: Props) {
  const { lang, m } = useI18n();
  const t = m.camera;
  useBackToClose(onClose);

  const signal = readinessSignal(aedModel);
  const seconds = readinessSeconds(aedModel);
  const maxMs = (signal === 'blink' ? seconds + EXTRA_BLINK_SECONDS : seconds + 1) * 1000;
  const example = getReferenceExamples('readiness_indicator', aedModel)?.find((e) => e.focus);

  const stageRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<FrameVideo>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef(0);
  /** Blinks safely inside the clip being recorded. */
  const clipBlinksRef = useRef(0);
  const discardRef = useRef(false);
  const stageStateRef = useRef<Stage>('starting');
  const latestReport = useRef<DetectorReport>({ flashes: 0, lastFlashAt: null, lit: false, quality: 'ok' });
  // One detector for the whole screen: blinks seen while lining up show the
  // light is in the circle, and starting to record doesn't relearn the scene.
  const detectorRef = useRef<ReadinessDetector | null>(null);

  const [stage, setStageState] = useState<Stage>('starting');
  const [failure, setFailure] = useState<CameraFailure>('unavailable');
  const [report, setReport] = useState<DetectorReport>(latestReport.current);
  const [elapsed, setElapsed] = useState(0);
  const [clipBlinks, setClipBlinks] = useState(0);
  const [ringPx, setRingPx] = useState(160);
  const [bigMap, setBigMap] = useState(false);

  const setStage = useCallback((next: Stage) => {
    stageStateRef.current = next;
    setStageState(next);
  }, []);

  // The circle's size follows the screen.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const measure = () => setRingPx(Math.round(RING_FRACTION * Math.min(el.clientWidth, el.clientHeight)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Camera on for as long as this screen is up.
  useEffect(() => {
    let cancelled = false;
    let releaseScreen = () => {};
    (async () => {
      try {
        const stream = await openBackCamera();
        if (cancelled) {
          stopStream(stream);
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => undefined);
        }
        releaseScreen = await keepScreenOn();
        if (!cancelled) setStage('live');
      } catch (err) {
        if (cancelled) return;
        setFailure(cameraFailureOf(err));
        setStage('failed');
      }
    })();
    return () => {
      cancelled = true;
      discardRef.current = true;
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') recorder.stop();
      stopStream(streamRef.current);
      streamRef.current = null;
      releaseScreen();
    };
  }, [setStage]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  }, []);

  const startRecording = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;
    const mimeType = recorderMimeType();
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: RECORDING_BITRATE });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        setFailure('unavailable');
        setStage('failed');
        return;
      }
    }
    chunksRef.current = [];
    discardRef.current = false;
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      recorderRef.current = null;
      if (discardRef.current || !chunksRef.current.length) {
        if (stageStateRef.current === 'recording') setStage('live');
        return;
      }
      const file = recordingFile(chunksRef.current, recorder.mimeType || mimeType || 'video/webm');
      const blinks = clipBlinksRef.current;
      stopStream(streamRef.current);
      streamRef.current = null;
      haptic(18);
      onCapture(file, blinks);
    };
    recorderRef.current = recorder;
    recStartRef.current = performance.now();
    clipBlinksRef.current = 0;
    setClipBlinks(0);
    setElapsed(0);
    recorder.start(500);
    haptic(12);
    setStage('recording');
  }, [onCapture, setStage]);

  // A recording cut short by leaving the page is thrown away, not sent.
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === 'hidden' && recorderRef.current) {
        discardRef.current = true;
        stopRecording();
      }
    };
    document.addEventListener('visibilitychange', onHidden);
    return () => document.removeEventListener('visibilitychange', onHidden);
  }, [stopRecording]);

  // Watch the circle, frame by frame.
  useEffect(() => {
    if (stage !== 'live' && stage !== 'recording') return;
    const video = videoRef.current;
    const stageEl = stageRef.current;
    if (!video || !stageEl) return;
    const canvas = document.createElement('canvas');
    canvas.width = PATCH;
    canvas.height = PATCH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    const detector = (detectorRef.current ??= new ReadinessDetector(PATCH));
    let stopped = false;
    let lastTick = 0;

    const tick = () => {
      if (stopped) return;
      const now = performance.now();
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (vw && vh && now - lastTick >= 25) {
        lastTick = now;
        // The circle, in the camera's own pixels (the picture is cropped to
        // fill the screen).
        const cw = stageEl.clientWidth;
        const ch = stageEl.clientHeight;
        const scale = Math.max(cw / vw, ch / vh);
        const side = (RING_FRACTION * Math.min(cw, ch)) / scale;
        ctx.drawImage(video, vw / 2 - side / 2, vh / 2 - side / 2, side, side, 0, 0, PATCH, PATCH);
        const next = detector.push(ctx.getImageData(0, 0, PATCH, PATCH).data, now);
        const prev = latestReport.current;
        if (next.flashes > prev.flashes) {
          haptic(15);
          if (
            stageStateRef.current === 'recording' &&
            next.lastFlashAt !== null &&
            next.lastFlashAt - recStartRef.current >= CLIP_LEAD_MS
          ) {
            clipBlinksRef.current += 1;
            setClipBlinks(clipBlinksRef.current);
          }
        }
        if (next.flashes !== prev.flashes || next.lit !== prev.lit || next.quality !== prev.quality) {
          latestReport.current = next;
          setReport(next);
        } else {
          latestReport.current = next;
        }

        if (stageStateRef.current === 'recording') {
          const recFor = now - recStartRef.current;
          setElapsed((e) => (Math.floor(recFor / 250) !== Math.floor(e / 250) ? recFor : e));
          const inClip = clipBlinksRef.current;
          const blinkedEnough =
            signal === 'blink' &&
            inClip >= NEED_BLINKS &&
            recFor >= MIN_RECORD_MS &&
            next.lastFlashAt !== null &&
            now - next.lastFlashAt >= AFTER_LAST_BLINK_MS;
          if (blinkedEnough || recFor >= maxMs) {
            stopped = true;
            stopRecording();
            return;
          }
        }
      }
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(tick);
      else requestAnimationFrame(tick);
    };
    tick();
    return () => {
      stopped = true;
    };
  }, [stage, signal, maxMs, stopRecording]);

  const recording = stage === 'recording';
  const inClip = recording ? clipBlinks : 0;
  const found = signal === 'blink' && report.flashes > 0;
  const coach = (() => {
    if (stage === 'starting') return t.starting;
    if (report.quality === 'shaky') return t.shaky;
    if (report.quality === 'dark') return t.dark;
    if (report.quality === 'glare') return t.glare;
    if (signal === 'steady') return recording ? t.holdFor(seconds) : t.aimSteady;
    if (report.lit) return t.lightOn;
    if (recording && inClip === 0) return elapsed > 7000 ? t.noBlinkYet : t.searching;
    if (found) return t.found;
    return t.aimBlink;
  })();
  const warn = report.quality !== 'ok' && stage !== 'starting';
  const progress = Math.min(1, elapsed / maxMs);

  const body = (
    <div
      ref={stageRef}
      role="dialog"
      aria-modal="true"
      aria-label={m.items.readiness_indicator?.title ?? 'Readiness indicator'}
      className="fixed inset-0 z-[70] overflow-hidden bg-black text-white select-none"
    >
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
      />

      {stage !== 'failed' && (
        <>
          {/* The circle: the light goes here. Everything around it dims. */}
          <div
            aria-hidden
            className={cn(
              'pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] transition-colors duration-200',
              report.lit ? 'border-emerald-300' : found ? 'border-emerald-400' : 'border-white/85',
            )}
            style={{
              width: ringPx,
              height: ringPx,
              boxShadow: `0 0 0 9999px rgb(0 0 0 / 0.45)${report.lit ? ', 0 0 28px 6px rgb(52 211 153 / 0.65)' : ''}`,
            }}
          >
            <span className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/70" />
          </div>
        </>
      )}

      {/* Top: close, and where the light is on this unit. */}
      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          aria-label={t.close}
          className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/45 backdrop-blur"
        >
          <X className="h-5 w-5" strokeWidth={2.2} />
        </button>
        {example?.focus && stage !== 'failed' && (
          <button
            type="button"
            onClick={() => setBigMap((v) => !v)}
            aria-label={captionOf(example, lang)}
            className="overflow-hidden rounded-xl bg-white/95 text-left text-black shadow-lg transition-[width] duration-200"
            style={{ width: bigMap ? 'min(78vw, 300px)' : 132 }}
          >
            <span className="relative block aspect-[4/3] w-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={example.src} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <motion.span
                aria-hidden
                className="absolute rounded-full border-[3px] border-red-500"
                style={{
                  left: `${(example.focus.x + example.focus.w / 2) * 100}%`,
                  top: `${(example.focus.y + example.focus.h / 2) * 100}%`,
                  width: bigMap ? 34 : 22,
                  height: bigMap ? 34 : 22,
                  x: '-50%',
                  y: '-50%',
                }}
                animate={{ scale: [1, 1.35, 1], opacity: [1, 0.6, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
              />
            </span>
            <span className="block px-2 py-1 text-[11px] font-semibold leading-tight">
              {bigMap ? captionOf(example, lang) : t.whereIsLight}
            </span>
          </button>
        )}
      </div>

      {/* Bottom: what the phone sees, and the one control. */}
      <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-10">
        {stage === 'failed' ? (
          <div className="w-full max-w-sm rounded-2xl bg-black/70 p-4 text-center">
            <p className="text-callout">{failure === 'blocked' ? t.blocked : t.unavailable}</p>
            <button
              type="button"
              onClick={onUseCameraApp}
              className="pressable mt-4 flex h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-white text-headline text-black"
            >
              <Camera className="h-[18px] w-[18px]" strokeWidth={2} />
              {t.useCameraApp}
            </button>
          </div>
        ) : (
          <>
            <p
              role="status"
              aria-live="polite"
              className={cn(
                'rounded-full px-4 py-2 text-center text-callout font-semibold backdrop-blur',
                warn ? 'bg-amber-500/90 text-black' : found || report.lit ? 'bg-emerald-600/90' : 'bg-black/55',
              )}
            >
              {coach}
            </p>

            {recording && signal === 'blink' && (
              <div className="flex items-center gap-2 text-footnote text-white/85">
                {Array.from({ length: NEED_BLINKS }, (_, i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-2.5 w-2.5 rounded-full transition-colors',
                      i < inClip ? 'bg-emerald-400' : 'bg-white/35',
                    )}
                  />
                ))}
                <span>{t.blinksCaught(Math.min(inClip, NEED_BLINKS), NEED_BLINKS)}</span>
              </div>
            )}

            <div className="flex flex-col items-center gap-2">
              {recording ? (
                <button
                  type="button"
                  onClick={() => elapsed >= MIN_RECORD_MS && stopRecording()}
                  aria-label={t.stop}
                  className="pressable relative flex h-[76px] w-[76px] items-center justify-center"
                >
                  <svg viewBox="0 0 76 76" className="absolute inset-0 -rotate-90" aria-hidden>
                    <circle cx="38" cy="38" r="35" fill="none" stroke="rgb(255 255 255 / 0.3)" strokeWidth="4" />
                    <circle
                      cx="38"
                      cy="38"
                      r="35"
                      fill="none"
                      stroke="white"
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={2 * Math.PI * 35}
                      strokeDashoffset={2 * Math.PI * 35 * (1 - progress)}
                    />
                  </svg>
                  <span className="h-7 w-7 rounded-md bg-red-500" />
                </button>
              ) : (
                <button
                  type="button"
                  disabled={stage !== 'live'}
                  onClick={startRecording}
                  aria-label={t.record}
                  className="pressable flex h-[76px] w-[76px] items-center justify-center rounded-full border-4 border-white disabled:opacity-50"
                >
                  {stage === 'starting' ? (
                    <Loader2 className="h-7 w-7 animate-spin" />
                  ) : (
                    <span className="h-[58px] w-[58px] rounded-full bg-red-500" />
                  )}
                </button>
              )}
              <p className="text-footnote text-white/80">
                {recording
                  ? t.recording(Math.floor(elapsed / 1000))
                  : signal === 'blink'
                    ? t.autoStop
                    : t.holdFor(seconds)}
              </p>
            </div>

            {!recording && (
              <button
                type="button"
                onClick={onUseCameraApp}
                className="flex h-11 items-center px-3 text-footnote text-white/75 underline underline-offset-2"
              >
                {t.useCameraApp}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );

  return typeof document === 'undefined' ? null : createPortal(body, document.body);
}
