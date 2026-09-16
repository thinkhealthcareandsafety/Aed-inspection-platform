'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Activity, CheckCircle2, Percent, Timer, BarChart3 } from 'lucide-react';
import { api } from '@/lib/api';
import { CHECKLIST_SECTIONS } from '@/lib/checklist-config';
import {
  PageHeader,
  StatTile,
  SegmentedControl,
  Sparkline,
  EmptyState,
} from '@/components/dashboard/primitives';
import { FunnelChart } from '@/components/dashboard/FunnelChart';

const RANGES = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
];

const ITEM_TITLES: Record<string, string> = Object.fromEntries(
  CHECKLIST_SECTIONS.flatMap((s) => s.items.map((i) => [i.id, i.title])),
);

/** A sparkline with no axis is unreadable without a scale anchor, so the
 *  busiest day in the window is stated in words beside it. */
function DailyTile({
  label,
  values,
  color,
}: {
  label: string;
  values: number[];
  color?: string;
}) {
  const peak = values.length ? Math.max(...values) : 0;
  return (
    <div className="surface-group p-5">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-caption uppercase tracking-[0.06em] text-muted-foreground">{label}</p>
        <p className="text-caption text-muted-foreground tabular-nums shrink-0">peak {peak}</p>
      </div>
      <div className="mt-3">
        <Sparkline values={values} color={color} />
      </div>
    </div>
  );
}

export default function FunnelPage() {
  const [days, setDays] = useState(30);

  const { data, isLoading } = useQuery({
    queryKey: ['funnel', days],
    queryFn: () => api.insights.funnel(days).then((r) => r.data),
  });

  const totals = data?.totals;
  const hasData = (totals?.started ?? 0) > 0 || (data?.steps[0]?.sessions ?? 0) > 0;

  return (
    <div className="p-5 sm:p-8 max-w-5xl space-y-7">
      <PageHeader
        title="Inspection funnel"
        subtitle="How many people who open inspector.aedsmartx.com finish an inspection — and exactly where the rest give up."
        actions={
          <SegmentedControl name="range" options={RANGES} value={days} onChange={setDays} />
        }
      />

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
        </div>
      ) : !hasData ? (
        <EmptyState
          icon={BarChart3}
          title="No visits recorded yet"
          body="Tracking is live. As soon as people start using the public inspection page, this fills in with the drop-off at every step, which AED models convert best, and which checks give people the most trouble."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatTile label="Inspection records" value={totals?.started ?? 0} icon={Activity} />
            <StatTile label="Reports completed" value={totals?.completed ?? 0} icon={CheckCircle2} />
            <StatTile
              label="Completion rate"
              value={`${totals?.completionRate ?? 0}%`}
              icon={Percent}
            />
            <StatTile
              label="Median time"
              value={totals?.medianMinutes != null ? `${totals.medianMinutes}m` : '—'}
              icon={Timer}
              hint="Start to finished report"
            />
          </div>

          {data && <FunnelChart steps={data.steps} biggestDropIndex={data.biggestDropIndex} />}

          {/* Two honest numbers that will never match exactly, so say why
              before someone concludes one of them is broken. */}
          <p className="text-caption text-muted-foreground -mt-4 px-1">
            The funnel counts visits reported by the browser; the totals above come from
            inspection records on the server. Browsers that block scripts show up in the
            second but not the first.
          </p>

          {/* Two measures, two plots: a single sparkline can't carry both
              without a legend it has no room for. */}
          <div className="grid sm:grid-cols-2 gap-3">
            <DailyTile label="Started per day" values={(data?.daily ?? []).map((d) => d.started)} />
            <DailyTile
              label="Completed per day"
              values={(data?.daily ?? []).map((d) => d.completed)}
              color="hsl(var(--primary))"
            />
          </div>

          {!!data?.byModel.length && (
            <section>
              <div className="group-label">Completion by AED model</div>
              <div className="surface-group">
                {data.byModel.map((m) => (
                  <div key={m.model} className="surface-row px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-callout text-foreground truncate">{m.model}</span>
                      <span className="text-callout font-mono tabular-nums text-foreground shrink-0">
                        {m.rate.toFixed(0)}%
                        <span className="text-muted-foreground ml-2">
                          {m.completed}/{m.started}
                        </span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-[3px] bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-r-[3px] bg-primary"
                        style={{ width: `${Math.max(m.rate, m.completed > 0 ? 1.5 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!!data?.itemFriction.length && (
            <section>
              <div className="group-label">Checks people struggle with</div>
              <div className="surface-group">
                {data.itemFriction.slice(0, 6).map((item) => (
                  <div key={item.itemId} className="surface-row px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-callout text-foreground truncate">
                        {ITEM_TITLES[item.itemId] ?? item.itemId}
                      </span>
                      <span className="text-callout font-mono tabular-nums text-foreground shrink-0">
                        {item.failRate.toFixed(0)}%
                        <span className="text-muted-foreground ml-2">of {item.analyzed}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-[3px] bg-secondary overflow-hidden">
                      <div
                        className="h-full rounded-r-[3px]"
                        style={{
                          width: `${Math.max(item.failRate, item.failed > 0 ? 1.5 : 0)}%`,
                          backgroundColor: 'var(--status-serious)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-caption text-muted-foreground mt-2 px-1">
                Share of captures that failed or errored. A high number usually means the
                reference photo or the wording needs work — not that the AEDs are faulty.
              </p>
            </section>
          )}

          {!!data?.devices.length && (
            <p className="text-caption text-muted-foreground">
              {data.devices.map((d) => `${d.sessions} on ${d.device}`).join(' · ')}
            </p>
          )}
        </>
      )}
    </div>
  );
}
