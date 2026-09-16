/**
 * First-party funnel tracking for the public inspection flow.
 *
 * Three rules this module exists to enforce:
 *   1. Telemetry never blocks or breaks an inspection. Every call is
 *      fire-and-forget, wrapped, and failure is silent.
 *   2. No personal data leaves the page. A visitor is a random id; names,
 *      emails and phone numbers stay in the inspection record where the
 *      person knowingly put them.
 *   3. Events batch. A stairwell on 3G shouldn't spend its bandwidth on
 *      analytics, so events queue and go out together — or on the way out
 *      of the page via sendBeacon, which survives the tab closing.
 */
import { BASE_URL } from './api';

export type FunnelStep =
  | 'landing_view'
  | 'contact_submitted'
  | 'model_selected'
  | 'inspection_started'
  | 'first_item_analyzed'
  | 'all_required_done'
  | 'inspection_completed';

export type TrackedEvent =
  | FunnelStep
  | 'item_analyzed'
  | 'item_skipped'
  | 'item_error'
  | 'item_retaken'
  | 'reference_opened'
  | 'inspection_resumed'
  | 'report_downloaded';

interface EventPayload {
  inspectionId?: string;
  aedModel?: string;
  itemId?: string;
  outcome?: string;
}

const VISITOR_KEY = 'aed_visitor';
const SESSION_KEY = 'aed_session';
const SESSION_START_KEY = 'aed_session_start';
const SENT_STEPS_KEY = 'aed_sent_steps';
const FLUSH_DELAY_MS = 1200;

const FUNNEL_STEPS: readonly string[] = [
  'landing_view',
  'contact_submitted',
  'model_selected',
  'inspection_started',
  'first_item_analyzed',
  'all_required_done',
  'inspection_completed',
];

function randomId(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

/** Storage is unavailable in private modes and locked-down browsers; tracking
 *  degrades to per-page-load ids rather than throwing into the app. */
function readOrCreate(store: Storage | undefined, key: string, make: () => string): string {
  if (!store) return make();
  try {
    const existing = store.getItem(key);
    if (existing) return existing;
    const created = make();
    store.setItem(key, created);
    return created;
  } catch {
    return make();
  }
}

let memoVisitor: string | null = null;
let memoSession: string | null = null;

function visitorId(): string {
  if (memoVisitor) return memoVisitor;
  memoVisitor = readOrCreate(typeof window === 'undefined' ? undefined : window.localStorage, VISITOR_KEY, randomId);
  return memoVisitor;
}

function sessionId(): string {
  if (memoSession) return memoSession;
  memoSession = readOrCreate(typeof window === 'undefined' ? undefined : window.sessionStorage, SESSION_KEY, randomId);
  return memoSession;
}

function sessionStart(): number {
  const raw = readOrCreate(
    typeof window === 'undefined' ? undefined : window.sessionStorage,
    SESSION_START_KEY,
    () => String(Date.now()),
  );
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

function device(): 'mobile' | 'tablet' | 'desktop' {
  if (typeof window === 'undefined') return 'desktop';
  const w = window.innerWidth;
  if (w < 640) return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}

/** Funnel steps count once per visit. Deduping here as well as in the
 *  database saves a pointless request on every re-render or refresh. */
function alreadySent(event: string): boolean {
  if (!FUNNEL_STEPS.includes(event)) return false;
  try {
    const raw = window.sessionStorage.getItem(SENT_STEPS_KEY);
    const sent: string[] = raw ? JSON.parse(raw) : [];
    if (sent.includes(event)) return true;
    window.sessionStorage.setItem(SENT_STEPS_KEY, JSON.stringify([...sent, event]));
    return false;
  } catch {
    return false;
  }
}

type QueuedEvent = Record<string, unknown>;

let queue: QueuedEvent[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function send(events: QueuedEvent[], beacon: boolean): void {
  if (!events.length) return;
  const url = `${BASE_URL}/api/v1/events`;
  const body = JSON.stringify({ events });

  try {
    if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {
      // Analytics must never surface an error to the inspector.
    });
  } catch {
    // Same.
  }
}

function flush(beacon = false): void {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const batch = queue;
  queue = [];
  send(batch, beacon);
}

export function track(event: TrackedEvent, payload: EventPayload = {}): void {
  if (typeof window === 'undefined') return;
  try {
    if (alreadySent(event)) return;

    queue.push({
      visitorId: visitorId(),
      sessionId: sessionId(),
      event,
      elapsedMs: Math.max(0, Date.now() - sessionStart()),
      device: device(),
      referrer: document.referrer ? document.referrer.slice(0, 300) : undefined,
      ...payload,
    });

    // A completed inspection is the event we least want to lose to a closed
    // tab, so it goes immediately rather than waiting for the batch window.
    if (event === 'inspection_completed' || queue.length >= 20) {
      flush();
      return;
    }
    if (!timer) timer = setTimeout(() => flush(), FLUSH_DELAY_MS);
  } catch {
    // Never let tracking throw into a render or a click handler.
  }
}

/** Called once from the app shell: makes sure a queued batch survives the
 *  tab being backgrounded or closed mid-inspection. */
export function installTrackingFlush(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onHide = () => flush(true);
  window.addEventListener('pagehide', onHide);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') onHide();
  });
  return () => window.removeEventListener('pagehide', onHide);
}
