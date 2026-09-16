/**
 * Funnel analytics for the public inspection flow.
 *
 * Deliberately first-party: the drop-off curve for this funnel is the
 * business's own operating data, so it lives in our database rather than a
 * third party's, with no cost ceiling, no sampling and no cookie banner. It
 * is also deliberately anonymous — a visitor is a random id minted in the
 * browser, never an email or phone number. Once someone submits their
 * details the inspection record holds the identity; the event stream only
 * needs to know that *a* visitor moved one step further.
 */
import mongoose, { Document, Schema } from 'mongoose';

/** The ordered funnel. Anything outside this list is a diagnostic event. */
export const FUNNEL_STEPS = [
  'landing_view',
  'contact_submitted',
  'model_selected',
  'inspection_started',
  'first_item_analyzed',
  'all_required_done',
  'inspection_completed',
] as const;

export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const DIAGNOSTIC_EVENTS = [
  'item_analyzed',
  'item_skipped',
  'item_error',
  'item_retaken',
  'reference_opened',
  'inspection_resumed',
  'report_downloaded',
] as const;

export const TRACKED_EVENTS = [...FUNNEL_STEPS, ...DIAGNOSTIC_EVENTS] as const;
export type TrackedEvent = (typeof TRACKED_EVENTS)[number];

export interface IAnalyticsEvent extends Document {
  /** Stable across visits (localStorage) — "how many people". */
  visitorId: string;
  /** One per tab/visit (sessionStorage) — "how many attempts". */
  sessionId: string;
  event: TrackedEvent;
  inspectionId?: string;
  aedModel?: string;
  itemId?: string;
  /** 'pass' | 'fail' | 'error' | … — whatever the event is reporting. */
  outcome?: string;
  /** Milliseconds since the visit started, for time-to-step analysis. */
  elapsedMs?: number;
  device?: 'mobile' | 'tablet' | 'desktop';
  referrer?: string;
  createdAt: Date;
}

const AnalyticsEventSchema = new Schema<IAnalyticsEvent>(
  {
    visitorId: { type: String, required: true },
    sessionId: { type: String, required: true },
    event: { type: String, required: true },
    inspectionId: { type: String },
    aedModel: { type: String },
    itemId: { type: String },
    outcome: { type: String },
    elapsedMs: { type: Number },
    device: { type: String, enum: ['mobile', 'tablet', 'desktop'] },
    referrer: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Every funnel query is "this event, in this window".
AnalyticsEventSchema.index({ event: 1, createdAt: -1 });
AnalyticsEventSchema.index({ createdAt: -1 });
// Dedupe guard: a step counts once per session, so a refresh or a double-fire
// can't inflate the funnel.
AnalyticsEventSchema.index(
  { sessionId: 1, event: 1, itemId: 1 },
  { unique: true, partialFilterExpression: { event: { $in: FUNNEL_STEPS as unknown as string[] } } },
);

export const AnalyticsEvent = mongoose.model<IAnalyticsEvent>('AnalyticsEvent', AnalyticsEventSchema);
