'use client';

import * as RadixDialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;

export function DialogContent({
  children,
  className,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  title: string;
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm fade-in" />
      <RadixDialog.Content
        className={cn(
          'fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl bg-card shadow-2xl focus:outline-none sheet-in',
          className,
        )}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/60 sticky top-0 bg-card/95 backdrop-blur-sm">
          <RadixDialog.Title className="font-display text-sm font-bold tracking-tight">{title}</RadixDialog.Title>
          <RadixDialog.Close className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            <X className="w-4 h-4" />
          </RadixDialog.Close>
        </div>
        <div className="p-5">{children}</div>
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}
