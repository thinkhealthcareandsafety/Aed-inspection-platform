'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { springSnappy } from '@/lib/motion';

/** Page title block. One h1, one line of plain-language purpose, actions on
 *  the right — the same shape on every screen so the eye never re-learns it. */
export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-title text-foreground">{title}</h1>
        {subtitle && <p className="text-body text-muted-foreground mt-1 max-w-xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

/**
 * A number worth looking at. Tiles are selectable where they double as
 * filters — the affordance is a ring rather than a fill, so a selected tile
 * stays as quiet as an unselected one.
 */
export function StatTile({
  label,
  value,
  hint,
  accent,
  icon: Icon,
  selected,
  onClick,
}: {
  label: string;
  value: string | number;
  hint?: string;
  /** CSS colour for the status dot and value — omit for the neutral default. */
  accent?: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  selected?: boolean;
  onClick?: () => void;
}) {
  const interactive = typeof onClick === 'function';

  const content = (
    <>
      <div className="flex items-center gap-1.5">
        {Icon && (
          <Icon
            className="w-3.5 h-3.5 shrink-0"
            strokeWidth={2}
            {...(accent ? { style: { color: accent } } : {})}
          />
        )}
        <span className="text-caption uppercase tracking-[0.06em] text-muted-foreground truncate">
          {label}
        </span>
      </div>
      {/* The number stays in ink. Status colour rides on the icon beside the
          label, so the figure is legible at any contrast and colour is never
          the only thing carrying the meaning. */}
      <div className="text-display font-mono tabular-nums mt-2 leading-none text-foreground">
        {value}
      </div>
      {hint && <p className="text-footnote text-muted-foreground mt-1.5">{hint}</p>}
    </>
  );

  if (!interactive) {
    return <div className="surface-group p-4 text-left">{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'pressable surface-group p-4 text-left transition-shadow',
        selected
          ? 'shadow-[0_0_0_2px_hsl(var(--foreground))]'
          : 'hover:shadow-[0_0_0_1px_hsl(var(--muted-foreground)/0.5)]',
      )}
    >
      {content}
    </button>
  );
}

/** iOS-style segmented control: the pill slides, the labels don't move. */
export function SegmentedControl<T extends string | number>({
  options,
  value,
  onChange,
  name,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  /** Unique per control — two controls sharing a layoutId animate into each other. */
  name: string;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 p-0.5 rounded-xl bg-secondary">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={String(opt.value)}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'relative px-3 h-8 rounded-[10px] text-footnote font-medium transition-colors',
              active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${name}`}
                transition={springSnappy}
                className="absolute inset-0 rounded-[10px] bg-card shadow-sm"
              />
            )}
            <span className="relative z-10">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * A single-series sparkline. Deliberately one series per chart: two measures
 * on one tiny plot would need a legend the tile has no room for, so volume
 * and completions get a sparkline each.
 */
export function Sparkline({
  values,
  color = 'hsl(var(--foreground))',
  className,
}: {
  values: number[];
  color?: string;
  className?: string;
}) {
  const width = 100;
  const height = 28;

  if (values.length < 2) return <div className={cn('h-7', className)} />;

  const max = Math.max(...values, 1);
  const step = width / (values.length - 1);
  const points = values.map((v, i) => [i * step, height - (v / max) * (height - 3) - 1.5] as const);

  const line = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const [lastX, lastY] = points[points.length - 1];
  const gradientId = `spark-${Math.round(values.reduce((a, b) => a + b, 0))}-${values.length}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn('w-full h-7 overflow-visible', className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2.5} fill={color} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** Shown wherever a list has nothing in it — says what would put something
 *  there, rather than just "No data". */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="surface-group px-6 py-14 flex flex-col items-center text-center">
      <div className="w-11 h-11 rounded-2xl bg-secondary flex items-center justify-center">
        <Icon className="w-5 h-5 text-muted-foreground" strokeWidth={1.8} />
      </div>
      <h3 className="text-headline text-foreground mt-4">{title}</h3>
      <p className="text-footnote text-muted-foreground mt-1.5 max-w-sm">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
