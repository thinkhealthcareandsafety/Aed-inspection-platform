'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Search, Loader2, CalendarClock } from 'lucide-react';
import { api } from '@/lib/api';
import { URGENCY } from '@/lib/urgency';
import { PageHeader, StatTile, EmptyState } from '@/components/dashboard/primitives';
import { PipelineList } from '@/components/dashboard/PipelineList';
import type { ExpiryUrgency } from '@/types/insights';

type Filter = ExpiryUrgency | 'all';

export default function PipelinePage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['pipeline'],
    queryFn: () => api.insights.pipeline().then((r) => r.data),
  });

  // Filtering is instant and local: the whole list is already here, and a
  // round trip per keystroke would make the search feel like dial-up.
  const rows = useMemo(() => {
    if (!data) return [];
    const q = query.trim().toLowerCase();
    return data.rows.filter((r) => {
      if (filter !== 'all' && r.urgency !== filter) return false;
      if (!q) return true;
      return [r.contactName, r.contactEmail, r.contactPhone, r.aedModel, r.serialNumber]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [data, filter, query]);

  const summary = data?.summary;

  const tiles = [
    { key: 'expired' as const, label: 'Already expired', value: summary?.expired ?? 0 },
    { key: 'critical' as const, label: 'Within 30 days', value: summary?.critical ?? 0 },
    { key: 'soon' as const, label: '31 to 90 days', value: summary?.soon ?? 0 },
    { key: 'ok' as const, label: 'Later', value: summary?.ok ?? 0 },
  ];

  return (
    <div className="p-5 sm:p-8 max-w-5xl space-y-7">
      <PageHeader
        title="Replacement pipeline"
        subtitle="Every AED we have read an expiry date from, soonest first. Each line is a customer whose pads or battery must be replaced by law — and who already gave us their number."
        actions={
          <button
            type="button"
            onClick={() => api.insights.downloadPipelineCsv()}
            disabled={!summary?.total}
            className="pressable inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-callout text-foreground transition-colors disabled:opacity-40"
          >
            <Download className="w-4 h-4" strokeWidth={2} />
            Export CSV
          </button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {tiles.map((t) => (
          <StatTile
            key={t.key}
            label={t.label}
            value={t.value}
            icon={URGENCY[t.key].icon}
            accent={t.value > 0 ? URGENCY[t.key].color : undefined}
            selected={filter === t.key}
            onClick={() => setFilter(filter === t.key ? 'all' : t.key)}
          />
        ))}
      </div>

      <div className="flex items-center gap-3">
        <div className="surface-group flex items-center gap-2.5 px-3.5 h-11 flex-1">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" strokeWidth={2} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, number, model or serial"
            className="w-full bg-transparent text-body text-foreground placeholder:text-muted-foreground/45 focus:outline-none"
          />
        </div>
        {filter !== 'all' && (
          <button
            type="button"
            onClick={() => setFilter('all')}
            className="pressable h-11 px-4 rounded-xl bg-secondary hover:bg-secondary/80 text-callout text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Clear filter
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title={summary?.total ? 'Nothing matches that' : 'No expiry dates captured yet'}
          body={
            summary?.total
              ? 'Try a different search, or clear the filter to see the whole pipeline.'
              : 'As soon as someone photographs a pads or battery label at inspector.aedsmartx.com, the AI reads the date and the device appears here — with their name and number attached.'
          }
        />
      ) : (
        <PipelineList rows={rows} />
      )}

      {summary && summary.total > 0 && (
        <p className="text-caption text-muted-foreground">
          {summary.total} device{summary.total === 1 ? '' : 's'} tracked ·{' '}
          {summary.contactable} with contact details
        </p>
      )}
    </div>
  );
}
