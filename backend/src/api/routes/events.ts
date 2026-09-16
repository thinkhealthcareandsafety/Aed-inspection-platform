/**
 * Anonymous funnel-event ingest for the public inspection flow.
 *
 * Mounted outside /api/v1/public on purpose: the public flow's rate limit is
 * tuned for uploads and must not be spent on telemetry, and telemetry must
 * never be the reason a real inspection gets throttled.
 */
import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AnalyticsEvent, TRACKED_EVENTS } from '../../models/AnalyticsEvent';
import { logger } from '../../utils/logger';

const router = Router();

const eventSchema = z.object({
  visitorId: z.string().trim().min(8).max(64),
  sessionId: z.string().trim().min(8).max(64),
  event: z.enum(TRACKED_EVENTS),
  inspectionId: z.string().trim().max(64).optional(),
  aedModel: z.string().trim().max(80).optional(),
  itemId: z.string().trim().max(60).optional(),
  outcome: z.string().trim().max(40).optional(),
  elapsedMs: z.number().int().min(0).max(86_400_000).optional(),
  device: z.enum(['mobile', 'tablet', 'desktop']).optional(),
  referrer: z.string().trim().max(300).optional(),
});

const batchSchema = z.object({ events: z.array(eventSchema).min(1).max(40) });

const eventsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many events.' },
});

// POST /api/v1/events — fire-and-forget batch from the browser.
router.post('/', eventsLimiter, async (req: Request, res: Response) => {
  const parsed = batchSchema.safeParse(req.body);
  if (!parsed.success) {
    // Telemetry is never worth surfacing an error to a real inspector, and a
    // 4xx here would only teach the client to retry. Swallow it.
    return res.status(202).json({ accepted: 0 });
  }

  try {
    // ordered:false so one duplicate funnel step (a refresh, a double-fire)
    // doesn't discard the rest of the batch — the unique index is what makes
    // "one step per session" true, and rejecting the repeat is the point.
    await AnalyticsEvent.insertMany(parsed.data.events, { ordered: false });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code !== 11000) {
      logger.warn('analytics.ingest_failed', { message: (err as Error).message });
    }
  }

  return res.status(202).json({ accepted: parsed.data.events.length });
});

export default router;
