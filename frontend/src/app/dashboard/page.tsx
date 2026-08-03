import type { Metadata } from 'next';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { InspectionTable } from '@/components/dashboard/InspectionTable';

export const metadata: Metadata = { title: 'Dashboard' };

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6 max-w-screen-xl">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            AED inspection overview and history
          </p>
        </div>

        <Link
          href="/inspection"
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-all shadow-md shadow-primary/25"
        >
          <Zap className="w-4 h-4" />
          New Inspection
        </Link>
      </div>

      {/* Stats */}
      <StatsCards />

      {/* Table */}
      <InspectionTable />
    </div>
  );
}
