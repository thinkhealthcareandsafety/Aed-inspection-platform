'use client';

import { useCallback, useRef, useState } from 'react';

/**
 * Tracks one in-flight action — a download, an export — so its button can
 * show that something is happening and refuse a second tap meanwhile.
 *
 * Several buttons in the app fired a network request with no feedback at all:
 * tap "Download PDF" and nothing visibly happens for a second or two, so the
 * natural reaction is to tap again and start a second download.
 */
export function usePending() {
  const [pending, setPending] = useState(false);
  // A ref, not the state, guards re-entry: two taps inside one render would
  // both still read `pending` as false.
  const inFlight = useRef(false);

  const run = useCallback(async (action: () => Promise<unknown>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try {
      await action();
    } catch {
      // The API client already surfaces the error as a toast.
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);

  return [pending, run] as const;
}
