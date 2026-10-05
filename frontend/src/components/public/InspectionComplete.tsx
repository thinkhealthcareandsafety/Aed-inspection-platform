'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowRight, Check, Download, Loader2, Mail, PackagePlus, Plus, Share } from 'lucide-react';
import { cn } from '@/lib/utils';
import { deviceAge } from '@/lib/device-age';
import { DeviceAgeNotice } from '@/components/inspection/DeviceAgeNotice';
import { MAX_SCORE, READY_THRESHOLD, scoreOf } from '@/lib/score';
import { ScoreRing } from './ScoreRing';
import { api } from '@/lib/api';
import { CHECKLIST_ITEMS } from '@/lib/checklist-config';
import { modelDisplayName } from '@/lib/aed-models';
import { formatPhone } from '@/lib/countries';
import { describeExpiry, urgencyOf } from '@/lib/expiry';
import { readingOf } from '@/lib/readings';
import { URGENCY } from '@/lib/urgency';
import { springSnappy } from '@/lib/motion';
import { ChecklistIcon } from '@/components/icons';
import { StatusDot } from '@/components/inspection/StatusDot';
import { itemCopy, useI18n } from '@/i18n';
import type { Inspection, InspectionResult, ReplacementItem, ReplacementRequest } from '@/types';

/** How each verdict looks; what it says is in the messages. */
const VERDICT: Record<InspectionResult, { panel: string; tone: string }> = {
  PASS: {
    panel: 'bg-emerald-500/[0.08] ring-emerald-500/20',
    tone: 'text-emerald-700 dark:text-emerald-400',
  },
  FAIL: {
    panel: 'bg-destructive/[0.07] ring-destructive/20',
    tone: 'text-destructive',
  },
  REVIEW: {
    panel: 'bg-amber-500/[0.09] ring-amber-500/25',
    tone: 'text-amber-700 dark:text-amber-400',
  },
  INCOMPLETE: {
    panel: 'bg-secondary ring-border',
    tone: 'text-muted-foreground',
  },
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
  const { lang, m } = useI18n();
  const t = m.result;
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
  const verdictCopy = t.verdict[inspection.inspectionResult];
  const model = modelDisplayName(inspection.aedModel);
  const phone = formatPhone(inspection.guestPhone);
  const firstName = inspection.guestName?.trim().split(/\s+/)[0];
  const requested = inspection.replacementRequest;

  /** Finished after the readiness indicator and serial number. */
  const quick = inspection.scope === 'quick';

  const rows = useMemo(
    () =>
      CHECKLIST_ITEMS.map((item) => ({
        item,
        entry: inspection.checklist.find((c) => c.itemId === item.id),
      })).filter(({ item, entry }) => {
        if (!entry) return false;
        const done = entry.status === 'pass' || entry.status === 'fail';
        // A quick check lists what it checked, not eight checks it skipped.
        return quick ? done : item.required || done;
      }),
    [inspection.checklist, quick],
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
      const reading = entry ? readingOf(entry, m) : null;
      if (reading?.expiry && reading.expiry.days <= REPLACEMENT_WINDOW_DAYS) {
        list.push({ kind, value: reading.value, days: reading.expiry.days });
      }
    }
    return list;
  }, [inspection.checklist, m]);

  const anyExpired = needs.some((n) => n.days < 0);

  async function share() {
    if (!shareFile) return;
    try {
      await navigator.share({
        files: [shareFile],
        title: t.shareTitle,
        text: t.shareText(model, verdictCopy.eyebrow),
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

  const score = scoreOf(inspection.checklist);
  const serialEntry = inspection.checklist.find((c) => c.itemId === 'serial_number' && c.status === 'pass');
  const unitAge = serialEntry
    ? deviceAge(inspection.aedModel, serialEntry.aiData?.serial_number, serialEntry.aiData?.manufacture_date)
    : null;
  // The marking scheme's line: below 80, the AED fails readiness.
  const belowThreshold = inspection.inspectionResult === 'FAIL' && score < READY_THRESHOLD;
  const quickResult = inspection.inspectionResult === 'PASS' ? 'PASS' : 'FAIL';
  const subtitle = quick
    ? m.quick.result.subtitle[quickResult](model)
    : inspection.inspectionResult === 'PASS'
      ? t.subtitle.PASS(model, required.length)
      : belowThreshold
        ? m.score.below(model, READY_THRESHOLD)
      : inspection.inspectionResult === 'FAIL'
        ? t.subtitle.FAIL(model, failedCount, required.length)
        : inspection.inspectionResult === 'REVIEW'
          ? t.subtitle.REVIEW(model)
          : t.subtitle.INCOMPLETE;

  const completedAt = inspection.completedAt ? new Date(inspection.completedAt) : null;

  const requestedNote = requested && (
    <div className="mt-4 flex items-start gap-3 rounded-xl bg-emerald-500/10 px-3.5 py-3">
      <span className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0">
        <Check className="w-3.5 h-3.5" strokeWidth={3.2} />
      </span>
      <div className="min-w-0">
        <p className="text-callout font-semibold text-foreground">{t.requested.title}</p>
        <p className="text-footnote text-muted-foreground mt-0.5">{t.requested.body(phone)}</p>
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
        {/* A quick check has no score out of 100 — two of ten checks would
            read as 20 — so it shows its verdict, plainly labelled. */}
        {quick ? (
          <QuickBadge ready={quickResult === 'PASS'} label={m.quick.result.badge} />
        ) : (
          <ScoreRing
            score={score}
            tone={
              inspection.inspectionResult === 'PASS'
                ? 'ok'
                : inspection.inspectionResult === 'FAIL'
                  ? 'bad'
                  : inspection.inspectionResult === 'REVIEW'
                    ? 'warn'
                    : 'neutral'
            }
          />
        )}

        <p className={cn('mt-5 text-caption uppercase tracking-[0.08em] font-semibold', verdict.tone)}>
          {quick ? m.quick.result.eyebrow[quickResult] : verdictCopy.eyebrow}
        </p>
        <h1 className="text-display text-foreground mt-1.5">
          {!quick && belowThreshold ? m.score.failsTitle : verdictCopy.title}
        </h1>
        <p className="text-body text-muted-foreground mt-2">{subtitle}</p>
        <p className="mt-1.5 text-footnote text-muted-foreground">
          {quick ? m.quick.result.scope : `${m.score.label} ${score}/${MAX_SCORE} · ${m.score.needed(READY_THRESHOLD)}`}
        </p>

        <div className="mt-6 pt-4 border-t border-foreground/10 text-left">
          <p className="text-footnote text-foreground flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5 shrink-0 text-muted-foreground" strokeWidth={1.9} />
            <span className="truncate">
              {emailed && inspection.guestEmail ? t.emailed(inspection.guestEmail) : t.emailFailed}
            </span>
          </p>
          <p className="text-caption text-muted-foreground mt-1">
            {t.reportId(
              inspection.inspectionId.slice(0, 8).toUpperCase(),
              // Hindi's short months are clipped with a "॰" and its clock
              // reads "am"; the full month and a 24-hour time read cleanly.
              completedAt?.toLocaleString(m.locale, {
                day: 'numeric',
                month: lang === 'hi' ? 'long' : 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                ...(lang === 'hi' ? { hourCycle: 'h23' as const } : {}),
              }),
            )}
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
                {t.share}
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
              {downloading ? t.preparing : t.download}
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
            {needs.length > 1 ? t.replace.both : needs[0].kind === 'pads' ? t.replace.pads : t.replace.battery}
          </h2>
          <p className="text-footnote text-muted-foreground mt-1">
            {anyExpired ? t.replace.whyExpired : t.replace.whySoon} {t.replace.supply(model)}
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
                      {t.replace.kind[need.kind]} · {need.value}
                    </span>
                    <span
                      className={cn(
                        'flex items-center gap-1.5 text-caption mt-0.5',
                        need.days < 0 ? 'text-destructive' : 'text-muted-foreground',
                      )}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: urgency.color }} />
                      {describeExpiry(need.days, m.expiry)}
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
                {requesting ? t.replace.sending : t.replace.cta}
              </button>
              <p className="text-caption text-muted-foreground text-center mt-2">{t.replace.contactOn(phone)}</p>
            </>
          )}
        </motion.section>
      )}

      {unitAge && <DeviceAgeNotice age={unitAge} />}

      <section>
        <div className="group-label">{t.whatWeChecked}</div>
        <div className="surface-group">
          {rows.map(({ item, entry }) => {
            if (!entry) return null;
            const reading = readingOf(entry, m);
            const expired = Boolean(reading?.expiry && reading.expiry.days < 0);
            return (
              <div key={item.id} className="surface-row px-4 py-3 flex items-center gap-3">
                <StatusDot status={entry.status} />
                <span className="min-w-0 flex-1 text-callout text-foreground truncate">{itemCopy(m, item).title}</span>
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
                          {describeExpiry(reading.expiry.days, m.expiry)}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-caption text-muted-foreground">
                      {t.status[entry.status] ?? ''}
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
              <p className="text-callout font-medium text-foreground">{t.spares.title}</p>
              <p className="text-footnote text-muted-foreground mt-0.5">{t.spares.body(model)}</p>
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
                  {t.spares.cta}
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
          {t.another}
        </button>
        <p className="text-footnote text-muted-foreground mt-2">{t.detailsKept}</p>
        <button
          type="button"
          onClick={onStartOver}
          className="h-11 px-3 mt-2 text-callout text-muted-foreground hover:text-foreground transition-colors"
        >
          {t.startOver(firstName || undefined)}
        </button>
      </div>
    </div>
  );
}

/** The quick check's verdict: a tick or a warning, labelled as a quick check. */
function QuickBadge({ ready, label }: { ready: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <motion.span
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 22 }}
        className={cn(
          'flex h-[88px] w-[88px] items-center justify-center rounded-full text-white shadow-lg',
          ready ? 'bg-emerald-600' : 'bg-destructive',
        )}
      >
        {ready ? <Check className="h-11 w-11" strokeWidth={2.8} /> : <AlertTriangle className="h-10 w-10" strokeWidth={2.2} />}
      </motion.span>
      <span className="mt-3 rounded-full bg-background/70 px-2.5 py-0.5 text-caption font-semibold uppercase tracking-[0.08em] text-muted-foreground ring-1 ring-border">
        {label}
      </span>
    </div>
  );
}
