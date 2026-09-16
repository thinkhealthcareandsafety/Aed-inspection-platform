'use client';

import { Phone, Mail, MessageCircle, BatteryCharging, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { URGENCY, URGENCY_ORDER, describeRemaining, formatDate } from '@/lib/urgency';
import type { ExpiryUrgency, PipelineRow } from '@/types/insights';

/** Indian mobile numbers are stored with a country prefix; wa.me wants digits. */
function waLink(phone: string, row: PipelineRow): string {
  const digits = phone.replace(/\D/g, '');
  const what = row.nextExpiryKind === 'pads' ? 'pads' : 'battery';
  const message = `Hello${row.contactName ? ` ${row.contactName}` : ''}, this is Think Healthcare & Safety. Your AED inspection showed the ${what} on your ${row.aedModel ?? 'AED'} expiring on ${formatDate(row.nextExpiryAt)}. Shall we send you a replacement quote?`;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

function ContactActions({ row }: { row: PipelineRow }) {
  const actions = [
    row.contactPhone && {
      href: waLink(row.contactPhone, row),
      icon: MessageCircle,
      label: `WhatsApp ${row.contactName ?? 'contact'}`,
      external: true,
    },
    row.contactPhone && {
      href: `tel:${row.contactPhone.replace(/\s/g, '')}`,
      icon: Phone,
      label: `Call ${row.contactName ?? 'contact'}`,
    },
    row.contactEmail && {
      href: `mailto:${row.contactEmail}`,
      icon: Mail,
      label: `Email ${row.contactName ?? 'contact'}`,
    },
  ].filter(Boolean) as { href: string; icon: typeof Phone; label: string; external?: boolean }[];

  if (!actions.length) {
    return <span className="text-caption text-muted-foreground/70">No contact details</span>;
  }

  return (
    <div className="flex items-center gap-1">
      {actions.map((a) => (
        <a
          key={a.label}
          href={a.href}
          title={a.label}
          aria-label={a.label}
          {...(a.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="pressable w-9 h-9 rounded-xl flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
        >
          <a.icon className="w-4 h-4" strokeWidth={1.9} />
        </a>
      ))}
    </div>
  );
}

function Row({ row }: { row: PipelineRow }) {
  const urgency = URGENCY[row.urgency];
  const Icon = urgency.icon;
  const KindIcon = row.nextExpiryKind === 'pads' ? Zap : BatteryCharging;

  return (
    <div className="surface-row px-4 py-3.5 flex items-center gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-headline text-foreground truncate">
            {row.contactName || 'Unnamed contact'}
          </span>
        </div>
        <p className="text-footnote text-muted-foreground mt-0.5 truncate">
          {[row.aedModel, row.serialNumber && `SN ${row.serialNumber}`]
            .filter(Boolean)
            .join(' · ') || 'Model not recorded'}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <KindIcon className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" strokeWidth={1.8} />
          <span className="text-caption text-muted-foreground">
            {row.nextExpiryKind === 'pads' ? 'Pads' : 'Battery'} expire {formatDate(row.nextExpiryAt)}
          </span>
        </div>

        {/* On a phone the call is one tap away, where it belongs. */}
        <div className="sm:hidden mt-2 -ml-2">
          <ContactActions row={row} />
        </div>
      </div>

      <div className="shrink-0 text-right">
        <span
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-caption font-medium"
          style={{ color: urgency.color, backgroundColor: urgency.tint }}
        >
          <Icon className="w-3.5 h-3.5" strokeWidth={2.1} />
          {describeRemaining(row.daysRemaining)}
        </span>
        <p className="text-caption text-muted-foreground/70 mt-1.5">
          Checked {formatDate(row.lastInspectedAt)}
        </p>
      </div>

      <div className="shrink-0 hidden sm:block">
        <ContactActions row={row} />
      </div>
    </div>
  );
}

/**
 * Grouped by how soon the money is on the table, because that is the order
 * the calls get made in — not alphabetically, and not by inspection date.
 */
export function PipelineList({ rows }: { rows: PipelineRow[] }) {
  const grouped = URGENCY_ORDER.map((urgency) => ({
    urgency,
    rows: rows.filter((r) => r.urgency === urgency),
  })).filter((g) => g.rows.length > 0);

  return (
    <div className="space-y-7">
      {grouped.map(({ urgency, rows: groupRows }) => (
        <section key={urgency}>
          <div className="group-label flex items-center gap-2">
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{ backgroundColor: URGENCY[urgency as ExpiryUrgency].color }}
              aria-hidden="true"
            />
            {URGENCY[urgency as ExpiryUrgency].label}
            <span className="opacity-60 tabular-nums">({groupRows.length})</span>
          </div>
          <div className={cn('surface-group')}>
            {groupRows.map((row) => (
              <Row key={row.inspectionId} row={row} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
