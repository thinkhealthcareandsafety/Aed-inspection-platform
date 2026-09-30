/* eslint-disable @next/next/no-img-element */
import { cn } from '@/lib/utils';

/**
 * The aedsmartx wordmark with this product's name beside it: the site is
 * inspector.aedsmartx.com, so this is aedsmartx's Inspector. The wordmark is
 * the brand's own artwork, cut from aedsmartx.com, with a dark-theme version
 * whose black letters are white.
 */
export function BrandLockup({ className, compact }: { className?: string; compact?: boolean }) {
  const mark = compact ? 'h-[15px]' : 'h-[18px]';
  return (
    <span className={cn('inline-flex items-center', compact ? 'gap-2' : 'gap-2.5', className)}>
      <img src="/brand/aedsmartx.png" alt="aedsmartx" className={cn(mark, 'w-auto dark:hidden')} />
      <img src="/brand/aedsmartx-dark.png" alt="aedsmartx" className={cn(mark, 'hidden w-auto dark:block')} />
      <span aria-hidden className={cn('w-px bg-border', compact ? 'h-3.5' : 'h-4')} />
      <span className={cn('text-foreground', compact ? 'text-callout font-semibold' : 'text-headline')}>Inspector</span>
    </span>
  );
}

/** Think Health's logo, the company behind aedsmartx. */
export function ThinkHealthLogo({ className }: { className?: string }) {
  return (
    <>
      <img src="/brand/thinkhealth.png" alt="Think Health" className={cn('w-auto dark:hidden', className)} />
      <img src="/brand/thinkhealth-dark.png" alt="Think Health" className={cn('hidden w-auto dark:block', className)} />
    </>
  );
}
