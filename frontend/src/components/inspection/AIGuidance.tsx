'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useInspectionStore } from '@/stores/inspection-store';
import type { InspectionStatus } from '@/types';

const STATUS_CONFIG: Record<
  InspectionStatus,
  { icon: React.ReactNode; color: string; bg: string }
> = {
  waiting: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10 border-slate-500/20',
  },
  in_progress: {
    icon: <Loader2 className="w-4 h-4 animate-spin" />,
    color: 'text-primary',
    bg: 'bg-primary/10 border-primary/20',
  },
  complete: {
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
  },
  error: {
    icon: <AlertCircle className="w-4 h-4" />,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
  },
  paused: {
    icon: null,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
  },
};

export function AIGuidance() {
  const { session } = useInspectionStore();
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [prevInstruction, setPrevInstruction] = useState('');
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const instruction = session?.instruction ?? 'Waiting to start…';
  const status = session?.status ?? 'waiting';
  const cfg = STATUS_CONFIG[status];

  // Speak instruction when it changes
  useEffect(() => {
    if (!voiceEnabled) return;
    if (instruction === prevInstruction) return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(instruction);
    utt.rate = 0.95;
    utt.pitch = 1.0;
    utt.volume = 1;
    window.speechSynthesis.speak(utt);
    synthRef.current = utt;
    setPrevInstruction(instruction);
  }, [instruction, voiceEnabled, prevInstruction]);

  return (
    <div className={cn('rounded-xl border p-4 transition-all duration-300', cfg.bg)}>
      <div className="flex items-start gap-3">
        {/* Status icon */}
        <div className={cn('mt-0.5 shrink-0', cfg.color)}>{cfg.icon}</div>

        {/* Instruction */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.p
              key={instruction}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.25 }}
              className={cn('text-sm font-medium leading-relaxed', cfg.color)}
            >
              {instruction}
            </motion.p>
          </AnimatePresence>

          {/* Guidance hint */}
          {session?.guidance?.hint && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-muted-foreground mt-1"
            >
              {session.guidance.hint}
            </motion.p>
          )}
        </div>

        {/* Voice toggle */}
        <button
          onClick={() => setVoiceEnabled((v) => !v)}
          className={cn(
            'shrink-0 p-1.5 rounded-lg transition-colors',
            voiceEnabled
              ? 'text-primary bg-primary/10 hover:bg-primary/20'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary',
          )}
          title={voiceEnabled ? 'Disable voice' : 'Enable voice guidance'}
        >
          {voiceEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
