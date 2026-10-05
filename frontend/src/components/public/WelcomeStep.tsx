'use client';

import { motion } from 'framer-motion';
import { ChevronRight, ListChecks, Mail, Zap } from 'lucide-react';
import { ALL_CHECK_COUNT, QUICK_CHECK_IDS } from '@/lib/checklist-config';
import { screenTransition } from '@/lib/motion';
import { spokenWelcome } from '@/lib/voice-key';
import { ListenButton } from '@/components/inspection/ListenButton';
import { useI18n } from '@/i18n';

export type InspectionPath = 'quick' | 'full';

interface Props {
  name: string;
  email: string;
  onChoose: (path: InspectionPath) => void;
  onEditDetails: () => void;
}

/**
 * The moment after someone hands over their details. It does three jobs:
 * greets them, so the form felt like it bought something; shows the address
 * the report goes to, because a misspelt email loses the report silently and
 * this is the last cheap place to catch it; and asks how far they want to
 * go. The quick path still stops at the fork after the readiness check, so a
 * not-ready AED is steered to the full inspection whichever was picked here.
 */
export function WelcomeStep({ name, email, onChoose, onEditDetails }: Props) {
  const { m } = useI18n();
  const t = m.welcome;
  const firstName = name.trim().split(/\s+/)[0] ?? '';

  const paths = [
    { id: 'quick' as const, Icon: Zap, copy: t.quick, count: QUICK_CHECK_IDS.length },
    { id: 'full' as const, Icon: ListChecks, copy: t.full, count: ALL_CHECK_COUNT },
  ];

  return (
    <motion.div {...screenTransition} className="w-full max-w-sm mx-auto">
      <div className="mb-6 px-1">
        <div className="flex items-start gap-3">
          <h1 className="min-w-0 flex-1 text-display text-foreground break-words">{t.greeting(firstName)}</h1>
          {/* Says the screen, like the speaker on each check — without the
              name, which is the one part that can't be recorded ahead. */}
          <ListenButton itemId="welcome" text={spokenWelcome(m)} className="-mr-1 mt-0.5" />
        </div>
        <p className="text-body text-muted-foreground mt-3">{t.intro}</p>
      </div>

      <h2 className="group-label">{t.choose}</h2>
      <ul className="flex flex-col gap-2.5">
        {paths.map(({ id, Icon, copy, count }) => (
          <li key={id} className="pressable">
            <button
              type="button"
              onClick={() => onChoose(id)}
              className="surface-tile w-full flex items-center gap-4 p-4 pr-4 text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary text-foreground">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-headline text-foreground">{copy.title}</span>
                <span className="block text-caption text-muted-foreground mt-0.5">{copy.meta(count)}</span>
                <span className="block text-footnote text-muted-foreground mt-1.5">{copy.body}</span>
              </span>
              <ChevronRight className="w-5 h-5 text-muted-foreground/50 shrink-0" strokeWidth={2} />
            </button>
          </li>
        ))}
      </ul>

      <div className="mt-5 flex items-center gap-2 px-1">
        <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" strokeWidth={1.9} />
        <p className="min-w-0 flex-1 text-footnote text-muted-foreground">
          {t.reportTo(<span className="font-semibold text-foreground break-all">{email}</span>)}
        </p>
        <button
          type="button"
          onClick={onEditDetails}
          className="-my-2 -mr-2 h-10 shrink-0 rounded-lg px-2 text-footnote font-semibold text-primary hover:text-primary/80 transition-colors"
        >
          {t.edit}
        </button>
      </div>
    </motion.div>
  );
}
