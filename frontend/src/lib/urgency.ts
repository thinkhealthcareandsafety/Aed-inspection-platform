import { AlertOctagon, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import type { ExpiryUrgency } from '@/types/insights';

/**
 * How an expiry reads to the person working the list. Colour is never the only
 * signal — every urgency carries an icon and a written label too, because two
 * of these four sit below 3:1 contrast on a white surface and because a
 * colourblind reader should lose nothing.
 */
export const URGENCY: Record<
  ExpiryUrgency,
  { label: string; short: string; color: string; icon: typeof AlertOctagon; tint: string }
> = {
  expired: {
    label: 'Already expired',
    short: 'Expired',
    color: 'var(--status-critical)',
    icon: AlertOctagon,
    tint: 'rgba(208, 59, 59, 0.10)',
  },
  critical: {
    label: 'Expiring within 30 days',
    short: 'Within 30 days',
    color: 'var(--status-serious)',
    icon: AlertTriangle,
    tint: 'rgba(236, 131, 90, 0.12)',
  },
  soon: {
    label: 'Expiring in 31–90 days',
    short: '31–90 days',
    color: 'var(--status-warning)',
    icon: Clock,
    tint: 'rgba(250, 178, 25, 0.12)',
  },
  ok: {
    label: 'More than 90 days out',
    short: 'Later',
    color: 'var(--status-good)',
    icon: CheckCircle2,
    tint: 'rgba(12, 163, 12, 0.10)',
  },
};

export const URGENCY_ORDER: ExpiryUrgency[] = ['expired', 'critical', 'soon', 'ok'];

/** "18 days overdue" reads as an instruction; "-18 days" reads as a bug. */
export function describeRemaining(days: number): string {
  if (days < 0) {
    const overdue = Math.abs(days);
    return overdue === 1 ? '1 day overdue' : `${overdue} days overdue`;
  }
  if (days === 0) return 'Expires today';
  if (days === 1) return 'Expires tomorrow';
  if (days < 45) return `${days} days left`;
  const months = Math.round(days / 30);
  return `${months} months left`;
}

export function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  // Expiries are stored as the last instant of their month in UTC. Rendering
  // them in the viewer's zone (IST is +5:30) would roll 28 Feb 23:59Z forward
  // to 1 March — a month-long lie about when a customer's pads die.
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
