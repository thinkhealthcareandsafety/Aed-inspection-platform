import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ChecklistItemStatus } from '@/types';

/**
 * A check's state at a glance, in the space of one character. Every state
 * differs in shape as well as colour — a tick, a "!", a number, a dashed
 * ring — so none of it depends on telling red from green.
 *
 * Every state is opaque, because on the route the dots sit on the line that
 * joins them and must cover it.
 */
export function StatusDot({
  status,
  index,
  current,
  className,
}: {
  status?: ChecklistItemStatus;
  /** Shown inside an outstanding check, for "this is number 4". */
  index?: number;
  /** The check open right now: filled in the brand colour, with a halo. */
  current?: boolean;
  className?: string;
}) {
  const base = 'w-6 h-6 rounded-full flex items-center justify-center shrink-0';

  if (status === 'pass') {
    return (
      <span className={cn(base, 'bg-emerald-600 text-white', className)}>
        <Check className="w-3.5 h-3.5" strokeWidth={3.2} />
      </span>
    );
  }
  if (status === 'fail' || status === 'error') {
    return (
      <span className={cn(base, 'bg-destructive text-destructive-foreground', className)}>
        <span className="text-[13px] font-bold leading-none">!</span>
      </span>
    );
  }
  if (status === 'analyzing' || status === 'uploaded') {
    return (
      <span className={cn(base, 'bg-background', className)}>
        <Loader2 className="w-4 h-4 text-primary animate-spin" />
      </span>
    );
  }
  if (current) {
    return (
      <span
        className={cn(
          base,
          'bg-primary text-primary-foreground text-caption font-semibold tabular-nums ring-4 ring-primary/15',
          className,
        )}
      >
        {index}
      </span>
    );
  }
  if (status === 'skipped') {
    return <span className={cn(base, 'bg-background border-[1.5px] border-dashed border-muted-foreground/40', className)} />;
  }
  return (
    <span
      className={cn(
        base,
        'bg-background border-[1.5px] border-muted-foreground/30 text-caption text-muted-foreground tabular-nums',
        className,
      )}
    >
      {index}
    </span>
  );
}
