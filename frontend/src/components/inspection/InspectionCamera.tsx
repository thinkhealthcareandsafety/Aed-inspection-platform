'use client';

import { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, CameraOff, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInspectionStore } from '@/stores/inspection-store';
import type { Detection } from '@/types';

interface InspectionCameraProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  className?: string;
  style?: React.CSSProperties;
}

// Label colours per detection class
const LABEL_COLORS: Record<string, string> = {
  aed_body:          '#22d3ee',
  serial_label:      '#a78bfa',
  pads_label:        '#34d399',
  battery_label:     '#fbbf24',
  status_window:     '#f472b6',
  led_indicator:     '#4ade80',
  manufacturer_logo: '#60a5fa',
  status_tick:       '#4ade80',
  status_cross:      '#f87171',
  blink_led:         '#4ade80',
  barcode:           '#94a3b8',
  qr_code:           '#94a3b8',
};

export function InspectionCamera({ videoRef, canvasRef, className, style }: InspectionCameraProps) {
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { isCameraActive, isConnected, isStreaming, session } = useInspectionStore();
  const detections = session?.detections ?? [];
  const step = session?.step ?? 'wait_for_machine';

  // ── Draw bounding boxes on overlay canvas ─────────────────────────────────
  const drawDetections = useCallback(
    (dets: Detection[], videoWidth: number, videoHeight: number) => {
      const overlay = overlayCanvasRef.current;
      if (!overlay) return;

      const container = containerRef.current;
      if (!container) return;

      const { clientWidth: cw, clientHeight: ch } = container;
      overlay.width = cw;
      overlay.height = ch;

      const ctx = overlay.getContext('2d');
      if (!ctx) return;

      ctx.clearRect(0, 0, cw, ch);

      if (!dets.length || !videoWidth || !videoHeight) return;

      // Scale from video space → display space
      const scaleX = cw / videoWidth;
      const scaleY = ch / videoHeight;

      for (const det of dets) {
        const [x1, y1, x2, y2] = det.bbox;
        const color = LABEL_COLORS[det.label] ?? '#94a3b8';
        const alpha = Math.min(1, det.confidence + 0.2);

        const dx1 = x1 * scaleX;
        const dy1 = y1 * scaleY;
        const dw = (x2 - x1) * scaleX;
        const dh = (y2 - y1) * scaleY;

        // Box
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = alpha;
        ctx.strokeRect(dx1, dy1, dw, dh);

        // Fill
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha * 0.08;
        ctx.fillRect(dx1, dy1, dw, dh);
        ctx.globalAlpha = 1;

        // Label pill
        const label = `${det.label.replace(/_/g, ' ')} ${Math.round(det.confidence * 100)}%`;
        ctx.font = '11px Inter, sans-serif';
        const tw = ctx.measureText(label).width;
        const ph = 18;
        const pw = tw + 10;

        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        roundRect(ctx, dx1, dy1 - ph - 2, pw, ph, 4);
        ctx.fill();

        ctx.fillStyle = '#0f172a';
        ctx.globalAlpha = 1;
        ctx.fillText(label, dx1 + 5, dy1 - 6);
      }
    },
    [],
  );

  // Re-draw whenever detections change
  useEffect(() => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    drawDetections(detections, v.videoWidth, v.videoHeight);
  }, [detections, drawDetections, videoRef]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative overflow-hidden rounded-xl bg-black',
        'border border-border/50',
        className,
      )}
      style={style}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        className="camera-feed w-full h-full object-cover"
        playsInline
        muted
        autoPlay
      />

      {/* Hidden canvas for frame capture */}
      <canvas ref={canvasRef} className="hidden" />

      {/* Bounding box overlay */}
      <canvas
        ref={overlayCanvasRef}
        className="bbox-canvas w-full h-full"
      />

      {/* Scan line (active during streaming) */}
      <AnimatePresence>
        {isStreaming && (
          <div className="scan-overlay">
            <motion.div
              className="scan-line-element"
              initial={{ top: 0 }}
              animate={{ top: '100%' }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        )}
      </AnimatePresence>

      {/* Viewfinder corners */}
      <AnimatePresence>
        {isCameraActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-8 pointer-events-none"
          >
            <div className="viewfinder-corner viewfinder-corner-tl" />
            <div className="viewfinder-corner viewfinder-corner-tr" />
            <div className="viewfinder-corner viewfinder-corner-bl" />
            <div className="viewfinder-corner viewfinder-corner-br" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera off placeholder */}
      <AnimatePresence>
        {!isCameraActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card"
          >
            <CameraOff className="w-12 h-12 text-muted-foreground" />
            <p className="text-muted-foreground text-sm">Camera inactive</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status badges — top row */}
      <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
        {/* Connection pill */}
        <div
          className={cn(
            'flex items-center gap-1.5 text-xs px-2 py-1 rounded-full backdrop-blur-sm font-mono',
            isConnected
              ? 'bg-green-500/20 text-green-400 border border-green-500/30'
              : 'bg-slate-500/20 text-slate-400 border border-slate-500/30',
          )}
        >
          {isConnected ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          {isConnected ? 'CONNECTED' : 'OFFLINE'}
        </div>

        {/* Frame quality */}
        {session?.frameQuality && (
          <div
            className={cn(
              'text-xs px-2 py-1 rounded-full backdrop-blur-sm border font-mono',
              session.frameQuality.acceptable
                ? 'bg-primary/20 text-primary border-primary/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30',
            )}
          >
            {session.frameQuality.acceptable ? '✓ SHARP' : '⚠ BLURRY'}
          </div>
        )}

        {/* Detection count */}
        {detections.length > 0 && (
          <div className="text-xs px-2 py-1 rounded-full backdrop-blur-sm bg-card/60 text-muted-foreground border border-border/50 font-mono">
            {detections.length} obj
          </div>
        )}
      </div>

      {/* Step indicator — bottom */}
      <div className="absolute bottom-3 left-3 pointer-events-none">
        <div className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full backdrop-blur-sm bg-card/70 border border-border/50 text-muted-foreground font-mono uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-blink" />
          {step.replace(/_/g, ' ')}
        </div>
      </div>
    </div>
  );
}

// Helper: draw rounded rectangle
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
