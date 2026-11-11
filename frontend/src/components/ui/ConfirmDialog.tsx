'use client';

import { useEffect, useState, type ReactNode } from 'react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { AlertTriangle, Loader2 } from 'lucide-react';

/**
 * The warning before something that can't be undone. Cancel has the focus,
 * so a stray Enter backs out; the red button names exactly what happens.
 * With `typeToConfirm`, that word must be typed first: kept for actions that
 * remove many things at once.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  children,
  confirmLabel,
  busy = false,
  typeToConfirm,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  typeToConfirm?: string;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = useState('');
  useEffect(() => {
    if (!open) setTyped('');
  }, [open]);
  const ready = !typeToConfirm || typed.trim().toUpperCase() === typeToConfirm.toUpperCase();

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm fade-in" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-card p-6 shadow-2xl focus:outline-none sheet-in">
          <div className="flex items-start gap-3.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <AlertTriangle className="h-5 w-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <AlertDialog.Title className="text-headline text-foreground">{title}</AlertDialog.Title>
              <AlertDialog.Description asChild>
                <div className="mt-1.5 space-y-2 text-callout text-muted-foreground">{children}</div>
              </AlertDialog.Description>
            </div>
          </div>

          {typeToConfirm && (
            <div className="mt-5">
              <label htmlFor="confirm-word" className="block text-footnote text-muted-foreground">
                Type <span className="font-mono font-semibold text-foreground">{typeToConfirm}</span> to confirm
              </label>
              <input
                id="confirm-word"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                disabled={busy}
                className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 font-mono text-callout text-foreground focus:outline-none focus:ring-2 focus:ring-destructive/40"
              />
            </div>
          )}

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel
              disabled={busy}
              className="h-10 rounded-xl bg-secondary px-4 text-callout font-medium text-foreground transition-colors hover:bg-secondary/75 disabled:opacity-60"
            >
              Cancel
            </AlertDialog.Cancel>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!ready || busy}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-destructive px-4 text-callout font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {confirmLabel}
            </button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
