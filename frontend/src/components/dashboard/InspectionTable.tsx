'use client';

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Download, ChevronLeft, ChevronRight, Search, Filter, Loader2, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import type { Inspection, InspectionResult } from '@/types';

const RESULT_BADGE: Record<InspectionResult, string> = {
  PASS: 'badge-pass',
  FAIL: 'badge-fail',
  REVIEW: 'badge-review',
  INCOMPLETE: 'badge-incomplete',
};

let countryNames: Intl.DisplayNames | undefined;
function countryName(code: string): string {
  try {
    countryNames ??= new Intl.DisplayNames(['en'], { type: 'region' });
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}

/** "Pune, MH, India", linked to the map when the lookup gave coordinates,
 *  with the IP beneath. Staff inspections and older ones have none. */
function VisitorCell({ visitor }: { visitor: Inspection['visitor'] }) {
  if (!visitor) return <span className="text-muted-foreground">—</span>;
  const place = [visitor.city, visitor.region, visitor.country && countryName(visitor.country)]
    .filter(Boolean)
    .join(', ');
  const hasPoint = visitor.latitude != null && visitor.longitude != null;
  return (
    <div className="min-w-0">
      {place ? (
        hasPoint ? (
          <a
            href={`https://www.google.com/maps?q=${visitor.latitude},${visitor.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-foreground hover:text-primary hover:underline whitespace-nowrap"
            title="Approximate — located from the visitor's IP address"
          >
            {place}
          </a>
        ) : (
          <span className="text-foreground whitespace-nowrap">{place}</span>
        )
      ) : (
        <span className="text-muted-foreground">Unknown</span>
      )}
      {visitor.ip && (
        <div className="font-mono text-[10.5px] text-muted-foreground mt-0.5">{visitor.ip}</div>
      )}
    </div>
  );
}

export function InspectionTable() {
  // One row at a time: a table of download buttons needs to know which one
  // was tapped, and to ignore a second tap on it while the PDF is fetched.
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  async function downloadPdf(inspectionId: string) {
    if (downloadingId) return;
    setDownloadingId(inspectionId);
    try {
      await api.reports.downloadPdf(inspectionId);
    } catch {
      // surfaced as a toast by the api client
    } finally {
      setDownloadingId(null);
    }
  }

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
  const visible = inspections.filter(
    (i) =>
      !search ||
      i.serialNumber?.toLowerCase().includes(search.toLowerCase()) ||
      i.manufacturer?.toLowerCase().includes(search.toLowerCase()),
  );

  // Deleting is for admins only (the API refuses everyone else too), and is
  // permanent: each delete goes through a warning first.
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toDelete, setToDelete] = useState<Inspection[] | null>(null);
  const [deleting, setDeleting] = useState(false);

  // A selection only ever covers rows on screen.
  useEffect(() => setSelected(new Set()), [page, resultFilter, search]);

  const allSelected = visible.length > 0 && visible.every((i) => selected.has(i.inspectionId));
  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(visible.map((i) => i.inspectionId)));
  }

  async function confirmDelete() {
    if (!toDelete?.length) return;
    setDeleting(true);
    try {
      const ids = toDelete.map((i) => i.inspectionId);
      const res = ids.length === 1 ? await api.inspections.remove(ids[0]) : await api.inspections.removeMany(ids);
      const n = res.data.deleted;
      toast.success(n === 1 ? 'Inspection deleted' : `${n} inspections deleted`);
      setSelected(new Set());
      setToDelete(null);
      // Back a page if this one is now empty.
      if (page > 1 && ids.length >= inspections.length) setPage((p) => p - 1);
      // Counts, the leads list and the funnel all change.
      await queryClient.invalidateQueries();
    } catch {
      // surfaced as a toast by the api client
    } finally {
      setDeleting(false);
    }
  }

  const columns = ['Date', 'AED Model', 'Serial', 'Pads Expiry', 'Result', 'Inspector', 'Location', ''];
  const columnCount = columns.length + (isAdmin ? 1 : 0);
  const one = toDelete?.length === 1 ? toDelete[0] : null;

  return (
    <div className="glass-card overflow-hidden">
      {/* Table header controls */}
      <div className="p-4 border-b border-border/50 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-bold">Recent Inspections</h2>
        </div>

        {isAdmin && selected.size > 0 && (
          <button
            type="button"
            onClick={() => setToDelete(visible.filter((i) => selected.has(i.inspectionId)))}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/15 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete selected ({selected.size})
          </button>
        )}

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
              {isAdmin && (
                <th className="pl-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    disabled={!visible.length}
                    aria-label="Select all inspections on this page"
                    className="h-3.5 w-3.5 rounded border-border accent-primary align-middle"
                  />
                </th>
              )}
              {columns.map(
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
                  {Array.from({ length: columnCount }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <div className="h-3 bg-muted/30 rounded animate-pulse w-16" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading &&
              visible.map((insp: Inspection, idx: number) => (
                  <motion.tr
                    key={insp._id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.02 }}
                    className={cn(
                      'border-b border-border/20 hover:bg-secondary/30 transition-colors',
                      selected.has(insp.inspectionId) && 'bg-destructive/5',
                    )}
                  >
                    {isAdmin && (
                      <td className="pl-4 py-3 w-8">
                        <input
                          type="checkbox"
                          checked={selected.has(insp.inspectionId)}
                          onChange={() => toggle(insp.inspectionId)}
                          aria-label="Select this inspection"
                          className="h-3.5 w-3.5 rounded border-border accent-primary align-middle"
                        />
                      </td>
                    )}
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
                      <VisitorCell visitor={insp.visitor} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <button
                        onClick={() => void downloadPdf(insp.inspectionId)}
                        disabled={downloadingId === insp.inspectionId}
                        className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors inline-flex disabled:opacity-70"
                        title={downloadingId === insp.inspectionId ? 'Preparing PDF…' : 'Download PDF'}
                        aria-label={downloadingId === insp.inspectionId ? 'Preparing PDF' : 'Download PDF'}
                      >
                        {downloadingId === insp.inspectionId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>
                      {isAdmin && (
                        <button
                          onClick={() => setToDelete([insp])}
                          className="ml-1 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors inline-flex"
                          title="Delete inspection"
                          aria-label="Delete inspection"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}

            {!isLoading && inspections.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="px-4 py-12 text-center text-muted-foreground">
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

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={one ? 'Delete this inspection?' : `Delete ${toDelete?.length ?? 0} inspections?`}
        confirmLabel={one ? 'Delete inspection' : `Delete ${toDelete?.length ?? 0} inspections`}
        typeToConfirm={one ? undefined : 'DELETE'}
        busy={deleting}
        onConfirm={() => void confirmDelete()}
      >
        {one && (
          <p className="font-medium text-foreground">
            {[
              one.aedModel ?? one.manufacturer,
              one.inspector?.name ?? one.guestName,
              one.startedAt && format(new Date(one.startedAt), 'dd MMM yyyy, HH:mm'),
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
        )}
        <p>
          This permanently deletes {one ? 'the inspection' : 'these inspections'}: the contact details, photos,
          results and report, and {one ? 'its' : 'their'} funnel stats.{' '}
          <strong className="text-foreground">It can’t be undone.</strong>
        </p>
      </ConfirmDialog>
    </div>
  );
}
