'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { CalendarClock, BarChart3, ClipboardList, Zap, Settings, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { springSnappy } from '@/lib/motion';
import { useAuthStore } from '@/stores/auth-store';
import { ThemeToggle } from '@/components/theme-toggle';
import { PulseLogo } from '@/components/icons';

/**
 * Ordered by how often it gets opened, not by hierarchy: the replacement
 * pipeline is the page a salesperson lives in, so it's first and it's what
 * /dashboard resolves to.
 */
const NAV_ITEMS = [
  { href: '/dashboard', icon: CalendarClock, label: 'Pipeline', exact: true },
  { href: '/dashboard/funnel', icon: BarChart3, label: 'Funnel' },
  { href: '/dashboard/inspections', icon: ClipboardList, label: 'Inspections' },
  { href: '/inspection', icon: Zap, label: 'Inspect' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

function useIsActive() {
  const pathname = usePathname();
  return (item: (typeof NAV_ITEMS)[number]) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export function Sidebar() {
  const isActive = useIsActive();
  const { user, clearAuth } = useAuthStore();

  return (
    <>
      {/* Desktop rail */}
      <aside className="hidden md:flex w-[232px] shrink-0 flex-col bg-background border-r border-border">
        <div className="px-5 pt-6 pb-5">
          <div className="flex items-center gap-2.5">
            <PulseLogo className="w-[18px] h-[18px] text-foreground shrink-0" />
            <span className="text-headline text-foreground">AED Inspect</span>
          </div>
          <p className="text-caption text-muted-foreground mt-1">Think Healthcare &amp; Safety</p>
        </div>

        <nav className="flex-1 px-3 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative flex items-center gap-2.5 px-3 h-10 rounded-xl text-callout transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    transition={springSnappy}
                    className="absolute inset-0 rounded-xl bg-secondary"
                  />
                )}
                <item.icon className="w-[17px] h-[17px] relative z-10 shrink-0" strokeWidth={1.9} />
                <span className="relative z-10">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2.5 px-2 py-1.5">
            <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-caption font-medium text-foreground shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-footnote text-foreground truncate">{user?.name ?? 'Inspector'}</p>
              <p className="text-caption text-muted-foreground truncate capitalize">{user?.role}</p>
            </div>
            <ThemeToggle />
            <button
              onClick={clearAuth}
              aria-label="Sign out"
              title="Sign out"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" strokeWidth={1.9} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-stretch bg-card/95 backdrop-blur-sm border-t border-border pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-1 py-2',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <item.icon className="w-[19px] h-[19px]" strokeWidth={active ? 2.1 : 1.8} />
              <span className="text-[10.5px] leading-none">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
