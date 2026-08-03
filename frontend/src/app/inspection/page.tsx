'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Square, Camera, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { useInspection } from '@/hooks/useInspection';
import { useInspectionStore } from '@/stores/inspection-store';
import { useAuthStore } from '@/stores/auth-store';
import { api } from '@/lib/api';

import { InspectionCamera } from '@/components/inspection/InspectionCamera';
import { InspectionTimeline } from '@/components/inspection/InspectionTimeline';
import { InspectionProgress } from '@/components/inspection/InspectionProgress';
import { AIGuidance } from '@/components/inspection/AIGuidance';
import { InspectionDataPanel } from '@/components/inspection/InspectionDataPanel';
import { InspectionResultCard } from '@/components/inspection/InspectionResultCard';

type Phase = 'idle' | 'camera' | 'inspecting' | 'complete';

export default function InspectionPage() {
  const [phase, setPhase] = useState<Phase>('idle');
  const { videoRef, canvasRef, openCamera, startInspection, stopInspection } = useInspection();
  const { session, isCameraActive, reset } = useInspectionStore();
  const { user } = useAuthStore();

  const handleOpenCamera = useCallback(async () => {
    await openCamera();
    setPhase('camera');
  }, [openCamera]);

  const handleStart = useCallback(async () => {
    if (!user) {
      toast.error('Please log in to start an inspection');
      return;
    }
    try {
      const res = await api.inspections.create({});
      const { inspection } = res.data;
      await startInspection(inspection.inspectionId, inspection.sessionId);
      setPhase('inspecting');
    } catch {
      toast.error('Could not start inspection session');
    }
  }, [user, startInspection]);

  const handleStop = useCallback(() => {
    stopInspection();
    setPhase('idle');
    reset();
  }, [stopInspection, reset]);

  const handleNewInspection = useCallback(() => {
    stopInspection();
    reset();
    setPhase('idle');
  }, [stopInspection, reset]);

  // Auto-advance to complete phase
  if (phase === 'inspecting' && session?.status === 'complete' && session?.step === 'complete') {
    setPhase('complete');
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-border/50 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </Link>
          <span className="text-border">/</span>
          <span className="text-sm font-medium">Live Inspection</span>
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          {user?.name ?? 'Inspector'}
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:flex-row gap-0 overflow-y-auto md:overflow-hidden">
        {/* Left column: camera + guidance + progress */}
        <div className="flex-1 flex flex-col p-4 md:p-6 gap-4 min-w-0">
          {/* Camera */}
          <InspectionCamera
            videoRef={videoRef}
            canvasRef={canvasRef}
            className="md:flex-1 min-h-0"
            style={{ minHeight: '320px', maxHeight: '520px' }}
          />

          {/* Progress bar */}
          <InspectionProgress />

          {/* AI Guidance */}
          <AIGuidance />

          {/* Action buttons */}
          <div className="flex gap-3">
            <AnimatePresence mode="wait">
              {phase === 'idle' && (
                <motion.button
                  key="open-camera"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  onClick={handleOpenCamera}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground font-medium transition-colors"
                >
                  <Camera className="w-5 h-5" />
                  Open Camera
                </motion.button>
              )}

              {phase === 'camera' && (
                <motion.button
                  key="start"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  onClick={handleStart}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-lg transition-all shadow-lg shadow-primary/25 animate-pulse-ring"
                >
                  <Play className="w-5 h-5 fill-current" />
                  Start Inspection
                </motion.button>
              )}

              {phase === 'inspecting' && (
                <motion.button
                  key="stop"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  onClick={handleStop}
                  className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/30 font-medium transition-colors"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Stop
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right sidebar: timeline + data */}
        <div className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-border/50 flex flex-col gap-4 p-4 md:p-5 md:overflow-y-auto">
          {/* Result card (when complete) */}
          <AnimatePresence>
            {phase === 'complete' && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <InspectionResultCard onStartNew={handleNewInspection} />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Timeline */}
          <div className="glass-card p-4">
            <InspectionTimeline />
          </div>

          {/* Data panel */}
          <InspectionDataPanel />
        </div>
      </div>
    </div>
  );
}
