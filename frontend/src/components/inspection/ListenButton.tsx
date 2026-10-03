'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Volume2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BASE_URL } from '@/lib/api';
import { track } from '@/lib/track';
import { voiceKey } from '@/lib/voice-key';
import { useI18n } from '@/i18n';

/** Only one voice at a time, across every button on the page. */
let stopCurrent: (() => void) | null = null;

/** The phone's own voice, for a line not recorded yet — the clearest one
 *  installed for the language. */
function browserVoice(lang: string): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
  const rank = (v: SpeechSynthesisVoice) =>
    (/natural|neural|google|premium|enhanced/i.test(v.name) ? 2 : 0) + (/-IN$/i.test(v.lang) ? 1 : 0);
  return voices.sort((a, b) => rank(b) - rank(a))[0];
}

/**
 * Reads a check's instructions aloud, for someone with one hand on the AED
 * and their eyes on the label, or who reads one language better than they
 * hear it. Each line is a recording made once by Google's text-to-speech and
 * kept on the server (backend routes/voice.ts), so the voice is the same
 * clear one on every phone. Should a recording not load, the phone's own
 * voice says it instead.
 */
export function ListenButton({ text, itemId, className }: { text: string; itemId: string; className?: string }) {
  const { lang, m } = useI18n();
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const stopRef = useRef<() => void>(() => {});

  const stop = useCallback(() => stopRef.current(), []);

  // A new check, or leaving the page, ends what was being read.
  useEffect(() => stop, [text, stop]);
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && stop();
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [stop]);

  const speakWithBrowser = useCallback(() => {
    if (!('speechSynthesis' in window)) {
      setState('idle');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    const voice = browserVoice(lang);
    if (voice) utterance.voice = voice;
    utterance.rate = 0.95;
    utterance.onstart = () => setState('playing');
    utterance.onend = utterance.onerror = () => setState('idle');
    stopRef.current = () => {
      window.speechSynthesis.cancel();
      setState('idle');
    };
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, [text, lang]);

  const play = useCallback(() => {
    if (state !== 'idle') {
      stop();
      return;
    }
    stopCurrent?.();
    stopCurrent = stop;

    setState('loading');
    const audio = new Audio(`${BASE_URL}/api/v1/voice/${voiceKey(lang, text)}.mp3`);
    let fellBack = false;
    const fallBack = () => {
      if (fellBack) return;
      fellBack = true;
      track('instructions_played', { itemId, outcome: `browser_${lang}` });
      speakWithBrowser();
    };
    stopRef.current = () => {
      audio.pause();
      audio.currentTime = 0;
      setState('idle');
    };
    audio.onplaying = () => {
      setState('playing');
      track('instructions_played', { itemId, outcome: `clip_${lang}` });
    };
    audio.onended = () => setState('idle');
    // A clip that won't load or play is still said, by the phone's voice.
    audio.onerror = fallBack;
    audio.play().catch((err: unknown) => {
      // Stopped by the person before it began: nothing to fall back from.
      if ((err as { name?: string })?.name !== 'AbortError') fallBack();
    });
  }, [state, stop, lang, text, itemId, speakWithBrowser]);

  const playing = state === 'playing';
  return (
    <button
      type="button"
      onClick={play}
      aria-label={playing ? m.check.stopListening : m.check.listen}
      aria-pressed={playing}
      title={playing ? m.check.stopListening : m.check.listen}
      className={cn(
        'pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors',
        playing ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary hover:bg-primary/15',
        className,
      )}
    >
      {state === 'loading' ? (
        <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={2.2} />
      ) : playing ? (
        <span aria-hidden className="flex h-4 items-center gap-[3px]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="voice-bar w-[3px] rounded-full bg-current"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </span>
      ) : (
        <Volume2 className="h-[18px] w-[18px]" strokeWidth={2.2} />
      )}
    </button>
  );
}
