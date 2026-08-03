'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  LayoutDashboard, Zap, FileText, Settings, LogOut,
  Heart, ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/inspection', icon: Zap, label: 'Inspect AED', accent: true },
  { href: '/reports', icon: FileText, label: 'Reports' },
  { href: '/settings', icon: Settings, label: 'Settings' },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-border/50 flex-col bg-card/30 backdrop-blur-sm">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border/30">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
              <Heart className="w-4 h-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-semibold leading-none">AED Inspect</p>
              <p className="text-xs text-muted-foreground mt-0.5">AI-Powered</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all relative group',
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60',
                  item.accent && !isActive && 'hover:bg-primary/10 hover:text-primary',
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="nav-active"
                    className="absolute inset-0 bg-primary/10 rounded-lg border border-primary/20"
                  />
                )}
                <item.icon className="w-4 h-4 relative z-10 shrink-0" />
                <span className="relative z-10 flex-1">{item.label}</span>
                {isActive && (
                  <ChevronRight className="w-3 h-3 relative z-10 text-primary/60" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4 border-t border-border/30">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg">
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{user?.name ?? 'Inspector'}</p>
              <p className="text-xs text-muted-foreground truncate capitalize">{user?.role}</p>
            </div>
            <button
              onClick={clearAuth}
              className="p-1 rounded hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile bottom tab bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 flex items-center bg-card/95 backdrop-blur-sm border-t border-border/50 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px]',
                isActive ? 'text-primary' : 'text-muted-foreground',
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={clearAuth}
          className="flex-1 flex flex-col items-center gap-0.5 py-2.5 text-[11px] text-muted-foreground"
        >
          <LogOut className="w-5 h-5" />
          Sign out
        </button>
      </nav>
    </>
  );
}
