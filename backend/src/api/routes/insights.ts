/**
 * Staff-only business intelligence over the public inspection flow.
 *
 * Two questions, two endpoints:
 *   /funnel   — where do people give up? (so the flow can be fixed)
 *   /pipeline — whose pads and batteries are about to expire? (so they can
 *               be sold a replacement before the device is non-compliant)
 *
 * The second is the commercial point of the free inspection: every completed
 * check hands us a dated, model-specific replacement need attached to a named
 * contact who has already told us they own the device.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { Inspection, IInspection } from '../../models/Inspection';
import { AnalyticsEvent, FUNNEL_STEPS } from '../../models/AnalyticsEvent';
import { daysUntil, urgencyOf, ExpiryUrgency } from '../../utils/expiry';

const router = Router();

const STEP_LABELS: Record<string, string> = {
  landing_view: 'Opened the page',
  contact_submitted: 'Entered their details',
  model_selected: 'Chose an AED model',
  inspection_started: 'Started the inspection',
  first_item_analyzed: 'Captured the first photo',
  all_required_done: 'Finished every required check',
  inspection_completed: 'Completed the inspection',
};

function windowStart(days: number): Date {
  const from = new Date();
  from.setUTCHours(0, 0, 0, 0);
  from.setUTCDate(from.getUTCDate() - (days - 1));
  return from;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;
}

// ── GET /api/v1/insights/funnel ──────────────────────────────────────────────
router.get('/funnel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const from = windowStart(days);

    const [stepRows, itemRows, deviceRows, inspections] = await Promise.all([
      AnalyticsEvent.aggregate<{ _id: string; sessions: string[] }>([
        { $match: { createdAt: { $gte: from }, event: { $in: FUNNEL_STEPS as unknown as string[] } } },
        { $group: { _id: '$event', sessions: { $addToSet: '$sessionId' } } },
      ]),
      AnalyticsEvent.aggregate<{ _id: { itemId: string; outcome: string }; count: number }>([
        { $match: { createdAt: { $gte: from }, event: 'item_analyzed', itemId: { $ne: null } } },
        { $group: { _id: { itemId: '$itemId', outcome: '$outcome' }, count: { $sum: 1 } } },
      ]),
      AnalyticsEvent.aggregate<{ _id: string; sessions: string[] }>([
        { $match: { createdAt: { $gte: from }, event: 'landing_view' } },
        { $group: { _id: '$device', sessions: { $addToSet: '$sessionId' } } },
      ]),
      Inspection.find({ source: 'public', startedAt: { $gte: from } })
        .select('aedModel inspectionStatus inspectionResult durationSeconds startedAt completedAt')
        .lean(),
    ]);

    const sessionsByStep = new Map(stepRows.map((r) => [r._id, r.sessions.length]));

    // The top of the funnel is the honest denominator: people who opened the
    // page. If tracking hasn't caught up (or an old visit predates it), fall
    // back to the largest step so conversions can't read above 100%.
    const counts = FUNNEL_STEPS.map((step) => sessionsByStep.get(step) ?? 0);
    const top = Math.max(...counts, 0);

    const steps = FUNNEL_STEPS.map((step, i) => {
      const sessions = counts[i];
      const prev = i === 0 ? sessions : counts[i - 1];
      return {
        key: step,
        label: STEP_LABELS[step] ?? step,
        sessions,
        // Everyone who reached the previous step and did not reach this one.
        lost: i === 0 ? 0 : Math.max(prev - sessions, 0),
        fromPrev: i === 0 ? 100 : pct(sessions, prev),
        fromTop: pct(sessions, top),
      };
    });

    // The single step worth fixing first: the largest absolute loss, not the
    // worst percentage — losing 40 of 50 matters more than 2 of 2.
    let biggestDropIndex = -1;
    steps.forEach((s, i) => {
      if (i > 0 && s.lost > 0 && (biggestDropIndex === -1 || s.lost > steps[biggestDropIndex].lost)) {
        biggestDropIndex = i;
      }
    });

    const completed = inspections.filter((i) => i.inspectionStatus === 'complete');
    const durations = completed
      .map((i) => i.durationSeconds ?? 0)
      .filter((d) => d > 0 && d < 4 * 3600);

    // Per-model completion — is one AED harder to inspect than another?
    const byModelMap = new Map<string, { started: number; completed: number }>();
    for (const i of inspections) {
      const key = i.aedModel ?? 'Unknown';
      const row = byModelMap.get(key) ?? { started: 0, completed: 0 };
      row.started += 1;
      if (i.inspectionStatus === 'complete') row.completed += 1;
      byModelMap.set(key, row);
    }

    // Daily volume, zero-filled so the chart has no invisible gaps.
    const dailyMap = new Map<string, { started: number; completed: number }>();
    for (let d = 0; d < days; d++) {
      const day = new Date(from);
      day.setUTCDate(day.getUTCDate() + d);
      dailyMap.set(day.toISOString().slice(0, 10), { started: 0, completed: 0 });
    }
    for (const i of inspections) {
      const key = new Date(i.startedAt).toISOString().slice(0, 10);
      const row = dailyMap.get(key);
      if (row) {
        row.started += 1;
        if (i.inspectionStatus === 'complete') row.completed += 1;
      }
    }

    // Which checks actually give people trouble — the shortlist for better
    // guidance, a clearer reference photo, or a prompt fix.
    const itemMap = new Map<string, { analyzed: number; failed: number; errored: number }>();
    for (const row of itemRows) {
      const key = row._id.itemId;
      const entry = itemMap.get(key) ?? { analyzed: 0, failed: 0, errored: 0 };
      entry.analyzed += row.count;
      if (row._id.outcome === 'fail') entry.failed += row.count;
      if (row._id.outcome === 'error') entry.errored += row.count;
      itemMap.set(key, entry);
    }

    res.json({
      range: { days, from, to: new Date() },
      steps,
      biggestDropIndex,
      totals: {
        started: inspections.length,
        completed: completed.length,
        completionRate: pct(completed.length, inspections.length),
        medianMinutes: durations.length ? Math.round((median(durations) ?? 0) / 6) / 10 : null,
      },
      byModel: [...byModelMap.entries()]
        .map(([model, v]) => ({ model, ...v, rate: pct(v.completed, v.started) }))
        .sort((a, b) => b.started - a.started),
      daily: [...dailyMap.entries()].map(([date, v]) => ({ date, ...v })),
      devices: deviceRows
        .map((r) => ({ device: r._id ?? 'unknown', sessions: r.sessions.length }))
        .sort((a, b) => b.sessions - a.sessions),
      itemFriction: [...itemMap.entries()]
        .map(([itemId, v]) => ({
          itemId,
          ...v,
          failRate: pct(v.failed + v.errored, v.analyzed),
        }))
        .sort((a, b) => b.failRate - a.failRate),
    });
  } catch (err) {
    next(err);
  }
});

// ── The replacement pipeline ─────────────────────────────────────────────────

interface PipelineRow {
  inspectionId: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  aedModel?: string;
  serialNumber?: string;
  padsExpiry?: string;
  padsExpiryAt?: Date;
  batteryExpiry?: string;
  batteryExpiryAt?: Date;
  /** Whichever consumable dies first — that's the date the sale hangs on. */
  nextExpiryAt: Date;
  nextExpiryKind: 'pads' | 'battery';
  daysRemaining: number;
  urgency: ExpiryUrgency;
  lastInspectedAt: Date;
  inspectionResult: string;
}

/**
 * One row per *device*, not per inspection: a customer who inspects the same
 * AED monthly should be one line in the sales list, showing what we last
 * read off it. Devices are keyed by serial number where the AI read one, and
 * fall back to the inspection id where it didn't.
 */
async function loadPipeline(): Promise<PipelineRow[]> {
  const docs = await Inspection.aggregate<IInspection>([
    {
      $match: {
        $or: [{ padsExpiryAt: { $type: 'date' } }, { batteryExpiryAt: { $type: 'date' } }],
      },
    },
    { $sort: { startedAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [
            { $gt: [{ $strLenCP: { $ifNull: ['$serialNumber', ''] } }, 3] },
            { $toUpper: '$serialNumber' },
            '$inspectionId',
          ],
        },
        doc: { $first: '$$ROOT' },
      },
    },
    { $replaceRoot: { newRoot: '$doc' } },
  ]);

  const now = new Date();
  return docs
    .map((d): PipelineRow | null => {
      const pads = d.padsExpiryAt ? new Date(d.padsExpiryAt) : undefined;
      const battery = d.batteryExpiryAt ? new Date(d.batteryExpiryAt) : undefined;
      const next = !pads ? battery : !battery ? pads : pads <= battery ? pads : battery;
      if (!next) return null;
      const kind: 'pads' | 'battery' = next === pads ? 'pads' : 'battery';
      const remaining = daysUntil(next, now);

      return {
        inspectionId: d.inspectionId,
        contactName: d.guestName,
        contactEmail: d.guestEmail,
        contactPhone: d.guestPhone,
        aedModel: d.aedModel,
        serialNumber: d.serialNumber,
        padsExpiry: d.padsExpiry,
        padsExpiryAt: pads,
        batteryExpiry: d.batteryExpiry,
        batteryExpiryAt: battery,
        nextExpiryAt: next,
        nextExpiryKind: kind,
        daysRemaining: remaining,
        urgency: urgencyOf(remaining),
        lastInspectedAt: d.startedAt,
        inspectionResult: d.inspectionResult,
      };
    })
    .filter((r): r is PipelineRow => r !== null)
    .sort((a, b) => a.nextExpiryAt.getTime() - b.nextExpiryAt.getTime());
}

// ── GET /api/v1/insights/pipeline ────────────────────────────────────────────
router.get('/pipeline', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const all = await loadPipeline();

    const summary = {
      total: all.length,
      expired: all.filter((r) => r.urgency === 'expired').length,
      critical: all.filter((r) => r.urgency === 'critical').length,
      soon: all.filter((r) => r.urgency === 'soon').length,
      ok: all.filter((r) => r.urgency === 'ok').length,
      contactable: all.filter((r) => r.contactPhone || r.contactEmail).length,
    };

    const urgency = String(req.query.urgency ?? '').trim();
    const q = String(req.query.q ?? '').trim().toLowerCase();

    let rows = all;
    if (urgency && urgency !== 'all') rows = rows.filter((r) => r.urgency === urgency);
    if (q) {
      rows = rows.filter((r) =>
        [r.contactName, r.contactEmail, r.contactPhone, r.aedModel, r.serialNumber]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q)),
      );
    }

    res.json({ summary, rows });
  } catch (err) {
    next(err);
  }
});

// ── GET /api/v1/insights/pipeline.csv ────────────────────────────────────────
// So the list can go straight into a CRM import or a call sheet.
router.get('/pipeline.csv', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await loadPipeline();
    const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const iso = (d?: Date) => (d ? new Date(d).toISOString().slice(0, 10) : '');

    const header = [
      'Name', 'Email', 'Phone', 'AED model', 'Serial number',
      'Pads expiry', 'Battery expiry', 'Next expiry', 'Expires', 'Days remaining',
      'Urgency', 'Last inspected', 'Result',
    ];
    const body = rows.map((r) =>
      [
        r.contactName, r.contactEmail, r.contactPhone, r.aedModel, r.serialNumber,
        r.padsExpiry, r.batteryExpiry, r.nextExpiryKind, iso(r.nextExpiryAt), r.daysRemaining,
        r.urgency, iso(r.lastInspectedAt), r.inspectionResult,
      ].map(escape).join(','),
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="aed-replacement-pipeline-${new Date().toISOString().slice(0, 10)}.csv"`,
    );
    res.send([header.map(escape).join(','), ...body].join('\r\n'));
  } catch (err) {
    next(err);
  }
});

export default router;
