import type { Metadata } from 'next';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { InspectionTable } from '@/components/dashboard/InspectionTable';

export const metadata: Metadata = { title: 'Inspections' };

export default function InspectionsPage() {
  return (
    <div className="p-5 sm:p-8 max-w-5xl space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-title text-foreground">Inspections</h1>
          <p className="text-body text-muted-foreground mt-1 max-w-xl">
            Every inspection run through the platform, staff and public, newest first.
          </p>
        </div>
        <Link
          href="/inspection"
          className="pressable inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-primary hover:bg-primary/92 text-primary-foreground text-callout transition-colors shrink-0"
        >
          <Zap className="w-4 h-4" strokeWidth={2} />
          New inspection
        </Link>
      </div>

      <StatsCards />
      <InspectionTable />
    </div>
  );
}
