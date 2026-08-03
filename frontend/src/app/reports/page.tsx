import type { Metadata } from 'next';
import { InspectionTable } from '@/components/dashboard/InspectionTable';

export const metadata: Metadata = { title: 'Reports' };

export default function ReportsPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Download PDF reports for completed AED inspections
        </p>
      </div>
      <InspectionTable />
    </div>
  );
}
