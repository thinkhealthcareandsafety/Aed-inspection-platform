'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, Download, Loader2, Mail, PackagePlus, Plus, Share } from 'lucide-react';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { CHECKLIST_ITEMS } from '@/lib/checklist-config';
import { modelDisplayName } from '@/lib/aed-models';
import { formatPhone } from '@/lib/countries';
import { describeExpiry, urgencyOf } from '@/lib/expiry';
import { readingOf } from '@/lib/readings';
import { URGENCY } from '@/lib/urgency';
import { EASE_OUT, springSnappy } from '@/lib/motion';
import { ChecklistIcon } from '@/components/icons';
import { StatusDot } from '@/components/inspection/StatusDot';
import type { Inspection, InspectionResult, ReplacementItem, ReplacementRequest } from '@/types';

const VERDICT: Record<
  InspectionResult,
  { eyebrow: string; title: string; panel: string; badge: string; tone: string }
> = {
  PASS: {
    eyebrow: 'Inspection passed',
    title: 'Ready to save a life',
    panel: 'bg-emerald-500/[0.08] ring-emerald-500/20',
    badge: 'bg-emerald-600 text-white',
    tone: 'text-emerald-700 dark:text-emerald-400',
  },
  FAIL: {
    eyebrow: 'Inspection failed',
    title: 'Not rescue-ready yet',
    panel: 'bg-destructive/[0.07] ring-destructive/20',
    badge: 'bg-destructive text-destructive-foreground',
    tone: 'text-destructive',
  },
  REVIEW: {
    eyebrow: 'Needs review',
    title: 'Needs a closer look',
    panel: 'bg-amber-500/[0.09] ring-amber-500/25',
    badge: 'bg-amber-500 text-white',
    tone: 'text-amber-700 dark:text-amber-400',
  },
  INCOMPLETE: {
    eyebrow: 'Incomplete',
    title: 'Inspection incomplete',
    panel: 'bg-secondary ring-border',
    badge: 'bg-muted-foreground text-background',
    tone: 'text-muted-foreground',
  },
};

const STATUS_WORD: Record<string, string> = {
  pass: 'Passed',
  fail: 'Failed',
  skipped: 'Skipped',
  error: 'Not done',
  pending: 'Not done',
};

/** Consumables within this many days of expiry get a replacement offer —
 *  the same 90-day line the sales pipeline calls "soon". */
const REPLACEMENT_WINDOW_DAYS = 90;

interface Props {
  inspection: Inspection;
  /** Whether the report email went out; null when that isn't known. */
  emailed: boolean | null;
  downloading: boolean;
  onDownload: () => void;
  onInspectAnother: () => void;
  onStartOver: () => void;
  onReplacementRequested: (request: ReplacementRequest) => void;
}

/**
 * The end of an inspection, built as the start of the next thing.
 *
 * It used to be a verdict word and two buttons — "Download" and "Start new
 * inspection", which threw away the person's details and made them type
 * them in again. Now it says in plain words whether the AED would work,
 * shows what was read off it, offers a quote the moment pads or a battery
 * are expired or close to it (asked for, so it is the one sales contact the
 * person has agreed to), and makes a second AED one tap away.
 */
export function InspectionComplete({
  inspection,
  emailed,
  downloading,
  onDownload,
  onInspectAnother,
  onStartOver,
  onReplacementRequested,
}: Props) {
  const [requesting, setRequesting] = useState(false);
  const [canShare, setCanShare] = useState(false);
  const [shareFile, setShareFile] = useState<File | null>(null);

  // Reports get forwarded — to a facilities head, a compliance inbox — and
  // on a phone the share sheet is how that happens. iOS only allows sharing
  // straight from the tap, with no network wait in between, so the PDF is
  // fetched ahead of it, and only where the browser can share files at all.
  useEffect(() => {
    let cancelled = false;
    try {
      const probe = new File([''], 'report.pdf', { type: 'application/pdf' });
      if (!navigator.canShare?.({ files: [probe] })) return;
    } catch {
      return;
    }
    setCanShare(true);
    api.public
      .fetchPdf(inspection.inspectionId, { skipErrorToast: true })
      .then((file) => !cancelled && setShareFile(file))
      .catch(() => !cancelled && setCanShare(false));
    return () => {
      cancelled = true;
    };
  }, [inspection.inspectionId]);
  const verdict = VERDICT[inspection.inspectionResult];
  const model = modelDisplayName(inspection.aedModel);
  const phone = formatPhone(inspection.guestPhone);
  const firstName = inspection.guestName?.trim().split(/\s+/)[0];
  const requested = inspection.replacementRequest;

  const rows = useMemo(
    () =>
      CHECKLIST_ITEMS.map((item) => ({
        item,
        entry: inspection.checklist.find((c) => c.itemId === item.id),
      })).filter(
        ({ item, entry }) => entry && (item.required || entry.status === 'pass' || entry.status === 'fail'),
      ),
    [inspection.checklist],
  );

  const required = rows.filter((r) => r.item.required);
  const failedCount = required.filter((r) => r.entry?.status === 'fail').length;

  /** Pads or a battery that are expired or inside the replacement window. */
  const needs = useMemo(() => {
    const list: { kind: 'pads' | 'battery'; value: string; days: number }[] = [];
    for (const [kind, itemId] of [
      ['pads', 'pads_expiry'],
      ['battery', 'battery_expiry'],
    ] as const) {
      const entry = inspection.checklist.find((c) => c.itemId === itemId);
      const reading = entry ? readingOf(entry) : null;
      if (reading?.expiry && reading.expiry.days <= REPLACEMENT_WINDOW_DAYS) {
        list.push({ kind, value: reading.value, days: reading.expiry.days });
      }
    }
    return list;
  }, [inspection.checklist]);

  const anyExpired = needs.some((n) => n.days < 0);

  async function share() {
    if (!shareFile) return;
    try {
      await navigator.share({
        files: [shareFile],
        title: 'AED inspection report',
        text: `${model}: ${verdict.eyebrow.toLowerCase()}.`,
      });
    } catch {
      // Dismissing the share sheet rejects too; there's nothing to report.
    }
  }

  async function requestQuote(items: ReplacementItem[]) {
    if (requesting) return;
    setRequesting(true);
    try {
      const res = await api.public.requestReplacement(inspection.inspectionId, items);
      onReplacementRequested(res.data.replacementRequest);
    } catch {
      // The API client already shows the error.
    } finally {
      setRequesting(false);
    }
  }

  const subtitle =
    inspection.inspectionResult === 'PASS'
      ? `Your ${model} passed all ${required.length} required checks.`
      : inspection.inspectionResult === 'FAIL'
        ? `${failedCount} of ${required.length} checks found a problem on your ${model}.`
        : inspection.inspectionResult === 'REVIEW'
          ? `Some checks on your ${model} couldn't be confirmed from the photos.`
          : 'Not every required check was completed.';

  const completedAt = inspection.completedAt ? new Date(inspection.completedAt) : null;

  const requestedNote = requested && (
    <div className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-500/10 px-3.5 py-3">
      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
        <Check className="w-3.5 h-3.5" strokeWidth={3.2} />
      </span>
      <div className="min-w-0">
        <p className="text-callout font-semibold text-foreground">Quote requested</p>
        <p className="text-footnote text-muted-foreground mt-0.5">
          {phone ? `We'll be in touch on ${phone}.` : "We'll be in touch shortly."}
        </p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springSnappy}
        className={cn('rounded-3xl ring-1 ring-inset px-6 pt-8 pb-5 text-center', verdict.panel)}
      >
        <div className="relative mx-auto w-[72px] h-[72px]">
          {inspection.inspectionResult === 'PASS' && (
            <motion.span
              aria-hidden
              className="absolute inset-0 rounded-full bg-emerald-500"
              initial={{ scale: 1, opacity: 0.35 }}
              animate={{ scale: 1.9, opacity: 0 }}
              transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.25 }}
            />
          )}
          <motion.span
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            className={cn(
              'relative w-full h-full rounded-full flex items-center justify-center shadow-lg',
              verdict.badge,
            )}
          >
            {inspection.inspectionResult === 'PASS' ? (
              <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <motion.path
                  d="M5 12.5l4.5 4.5L19 7.5"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.45, delay: 0.2, ease: EASE_OUT }}
                />
              </svg>
            ) : inspection.inspectionResult === 'FAIL' ? (
              <span className="text-[34px] font-bold leading-none">!</span>
            ) : (
              <AlertTriangle className="w-8 h-8" strokeWidth={2.2} />
            )}
          </motion.span>
        </div>

        <p className={cn('mt-5 text-caption uppercase tracking-[0.08em] font-semibold', verdict.tone)}>
          {verdict.eyebrow}
        </p>
        <h1 className="text-display text-foreground mt-1.5">{verdict.title}</h1>
        <p className="text-body text-muted-foreground mt-2">{subtitle}</p>

        <div className="mt-6 pt-4 border-t border-foreground/10 text-left">
          <p className="text-footnote text-foreground flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 shrink-0 text-muted-foreground" strokeWidth={1.9} />
            <span className="truncate">
              {emailed && inspection.guestEmail
                ? `Report emailed to ${inspection.guestEmail}`
                : 'Email didn’t send — download your report'}
            </span>
          </p>
          <p className="text-caption text-muted-foreground mt-1">
            Report {inspection.inspectionId.slice(0, 8).toUpperCase()}
            {completedAt &&
              ` · ${completedAt.toLocaleString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}`}
          </p>

          <div className="mt-3.5 flex gap-2">
            {canShare && (
              <button
                type="button"
                onClick={() => void share()}
                disabled={!shareFile}
                className="pressable inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-card text-callout font-semibold text-foreground shadow-[0_0_0_1px_hsl(var(--border))] transition-colors hover:bg-secondary disabled:opacity-70"
              >
                {shareFile ? <Share className="h-4 w-4" strokeWidth={2} /> : <Loader2 className="h-4 w-4 animate-spin" />}
                Share report
              </button>
            )}
            <button
              type="button"
              onClick={onDownload}
              disabled={downloading}
              className={cn(
                'pressable inline-flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-callout font-semibold transition-colors disabled:opacity-70',
                emailed
                  ? 'bg-card text-foreground shadow-[0_0_0_1px_hsl(var(--border))] hover:bg-secondary'
                  : 'bg-primary text-primary-foreground hover:bg-primary/92',
              )}
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" strokeWidth={2} />}
              {downloading ? 'Preparing…' : 'Download PDF'}
            </button>
          </div>
        </div>
      </motion.section>

      {needs.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springSnappy, delay: 0.12 }}
          className="surface-card p-5"
        >
          <h2 className="text-headline text-foreground">
            {needs.length > 1
              ? 'Replace the pads and battery'
              : needs[0].kind === 'pads'
                ? 'Replace the pads'
                : 'Replace the battery'}
          </h2>
          <p className="text-footnote text-muted-foreground mt-1">
            {anyExpired
              ? "Expired pads and batteries can fail when they're needed most."
              : 'Order ahead so this AED is never left without them.'}{' '}
            We supply replacements for the {model}.
          </p>

          <ul className="mt-4 flex flex-col gap-2">
            {needs.map((need) => {
              const urgency = URGENCY[urgencyOf(need.days)];
              return (
                <li key={need.kind} className="flex items-center gap-3 rounded-xl bg-secondary/60 px-3 py-2.5">
                  <span className="w-8 h-8 rounded-lg bg-card flex items-center justify-center shrink-0">
                    <ChecklistIcon
                      name={need.kind === 'pads' ? 'bolt' : 'battery'}
                      className="w-4 h-4 text-foreground/70"
                      strokeWidth={1.9}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-callout text-foreground">
                      {need.kind === 'pads' ? 'Pads' : 'Battery'} · {need.value}
                    </span>
                    <span
                      className={cn(
                        'flex items-center gap-1.5 text-caption mt-0.5',
                        need.days < 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: urgency.color }} />
                      {describeExpiry(need.days)}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>

          {requested ? (
            requestedNote
          ) : (
            <>
              <button
                type="button"
                disabled={requesting}
                onClick={() => void requestQuote(needs.map((n) => n.kind))}
                className="pressable w-full flex items-center justify-center gap-2 h-[52px] mt-4 rounded-2xl bg-primary text-primary-foreground text-headline hover:bg-primary/92 transition-colors disabled:opacity-60"
              >
                {requesting && <Loader2 className="w-4 h-4 animate-spin" />}
                {requesting ? 'Sending your request…' : 'Get a replacement quote'}
              </button>
              <p className="text-caption text-muted-foreground text-center mt-2">
                {phone ? `We'll contact you on ${phone}. ` : ''}No obligation.
              </p>
            </>
          )}
        </motion.section>
      )}

      <section>
        <div className="group-label">What we checked</div>
        <div className="surface-group">
          {rows.map(({ item, entry }) => {
            if (!entry) return null;
            const reading = readingOf(entry);
            const expired = Boolean(reading?.expiry && reading.expiry.days < 0);
            return (
              <div key={item.id} className="surface-row px-4 py-3 flex items-center gap-3">
                <StatusDot status={entry.status} />
                <span className="min-w-0 flex-1 text-callout text-foreground truncate">{item.title}</span>
                <span className="shrink-0 max-w-[48%] text-right">
                  {reading ? (
                    <>
                      <span
                        className={cn(
                          'block text-callout text-foreground truncate',
                          reading.mono && 'font-mono text-footnote',
                        )}
                      >
                        {reading.value}
                      </span>
                      {reading.expiry && (
                        <span
                          className={cn(
                            'block text-caption mt-0.5',
                            expired ? 'text-destructive' : 'text-muted-foreground',
                          )}
                        >
                          {describeExpiry(reading.expiry.days)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-caption text-muted-foreground">
                      {STATUS_WORD[entry.status] ?? ''}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {needs.length === 0 && (
        <section className="surface-tile p-4">
          <div className="flex items-start gap-3">
            <span className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center shrink-0">
              <PackagePlus className="w-5 h-5 text-foreground/70" strokeWidth={1.8} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-callout font-medium text-foreground">Need spares or accessories?</p>
              <p className="text-footnote text-muted-foreground mt-0.5">
                Pads, batteries, cabinets and rescue kits for your {model}.
              </p>
              {!requested && (
                <button
                  type="button"
                  disabled={requesting}
                  onClick={() => void requestQuote(['accessories'])}
                  className="pressable mt-3 inline-flex items-center gap-1.5 h-9 px-3.5 rounded-xl bg-secondary text-callout font-medium text-foreground hover:bg-secondary/75 transition-colors disabled:opacity-60"
                >
                  {requesting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ArrowRight className="w-4 h-4" strokeWidth={2.2} />
                  )}
                  Get a quote
                </button>
              )}
            </div>
          </div>
          {requestedNote}
        </section>
      )}

      <div className="flex flex-col items-center">
        <button
          type="button"
          onClick={onInspectAnother}
          className={cn(
            'pressable w-full flex items-center justify-center gap-2 h-[52px] rounded-2xl text-headline transition-colors',
            needs.length > 0 && !requested
              ? 'bg-secondary text-foreground hover:bg-secondary/75'
              : 'bg-primary text-primary-foreground hover:bg-primary/92',
          )}
        >
          <Plus className="w-[18px] h-[18px]" strokeWidth={2.2} />
          Inspect another AED
        </button>
        <p className="text-footnote text-muted-foreground mt-2">Your details are already filled in.</p>
        <button
          type="button"
          onClick={onStartOver}
          className="h-11 px-3 mt-2 text-callout text-muted-foreground hover:text-foreground transition-colors"
        >
          {firstName ? `Not ${firstName}? Start over` : 'Start over with new details'}
        </button>
      </div>
    </div>
  );
}
