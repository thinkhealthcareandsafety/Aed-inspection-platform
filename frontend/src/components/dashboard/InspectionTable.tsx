'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Download, ChevronLeft, ChevronRight, Search, Filter } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { Inspection, InspectionResult } from '@/types';

const RESULT_BADGE: Record<InspectionResult, string> = {
  PASS: 'badge-pass',
  FAIL: 'badge-fail',
  REVIEW: 'badge-review',
  INCOMPLETE: 'badge-incomplete',
};

export function InspectionTable() {
  const [page, setPage] = useState(1);
  const [resultFilter, setResultFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['inspections', page, resultFilter],
    queryFn: () =>
      api.inspections
        .list({ page, limit: 15, result: resultFilter || undefined })
        .then((r) => r.data),
    placeholderData: (prev) => prev,
  });

  const inspections = data?.data ?? [];
  const pagination = data?.pagination;

  return (
    <div className="glass-card overflow-hidden">
      {/* Table header controls */}
      <div className="p-4 border-b border-border/50 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold">Recent Inspections</h2>
        </div>

        {/* Search (client-side filter on loaded data for now) */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search serial…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg bg-secondary border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40"
          />
        </div>

        {/* Result filter */}
        <div className="relative">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <select
            value={resultFilter}
            onChange={(e) => { setResultFilter(e.target.value); setPage(1); }}
            className="pl-8 pr-6 py-1.5 text-xs rounded-lg bg-secondary border border-border/50 text-foreground focus:outline-none focus:ring-1 focus:ring-primary appearance-none"
          >
            <option value="">All results</option>
            <option value="PASS">Pass</option>
            <option value="FAIL">Fail</option>
            <option value="REVIEW">Review</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border/30">
              {['Date', 'AED Model', 'Serial', 'Pads Expiry', 'Result', 'Inspector', ''].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-muted-foreground font-semibold text-[10.5px] uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i} className="border-b border-border/20">
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-muted/30 rounded animate-pulse w-16" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading &&
              inspections
                .filter(
                  (i) =>
                    !search ||
                    i.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
                    i.manufacturer?.toLowerCase().includes(search.toLowerCase()),
                )
                .map((insp: Inspection, idx: number) => (
                  <motion.tr
                    key={insp._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className="border-b border-border/20 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {insp.startedAt
                        ? format(new Date(insp.startedAt), 'dd MMM yy HH:mm')
                        : '—'}
                    </td>
                    <td className="px-4 py-3 font-semibold">{insp.aedModel ?? insp.manufacturer ?? insp.model ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{insp.serialNumber ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{insp.padsExpiry ?? '—'}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold',
                          RESULT_BADGE[insp.inspectionResult as InspectionResult] ?? 'badge-incomplete',
                        )}
                      >
                        {insp.inspectionResult}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-foreground">{insp.inspector?.name ?? insp.guestName ?? '—'}</span>
                      {!insp.inspector && insp.guestName && (
                        <span className="ml-2 text-[9.5px] font-bold text-primary bg-primary/10 rounded px-1.5 py-0.5 tracking-wide">
                          WALK-UP
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => api.reports.downloadPdf(insp.inspectionId)}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors inline-flex"
                        title="Download PDF"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </motion.tr>
                ))}

            {!isLoading && inspections.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                  No inspections found.{' '}
                  <Link href="/inspection" className="text-primary hover:underline">
                    Start your first inspection →
                  </Link>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div className="px-4 py-3 border-t border-border/30 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {pagination.total} total · page {pagination.page} of {pagination.pages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages}
              className="p-1.5 rounded hover:bg-secondary disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
