'use client';

import { Printer } from 'lucide-react';

export function PrintButton({ label = 'Print the checklist' }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print pressable inline-flex h-10 items-center gap-2 rounded-xl bg-secondary px-4 text-callout font-medium text-foreground transition-colors hover:bg-secondary/75"
    >
      <Printer className="h-4 w-4" strokeWidth={2} />
      {label}
    </button>
  );
}
