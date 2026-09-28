'use client';

import { useEffect, useState } from 'react';

/**
 * Milliseconds since `active` last became true; 0 while inactive.
 *
 * Drives loaders that change what they say as a wait goes on. A spinner that
 * looks identical at second one and second fifteen reads as frozen — which is
 * exactly when people give up and reload, abandoning the upload.
 */
export function useElapsed(active: boolean, tickMs = 150): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!active) {
      setElapsed(0);
      return;
    }
    const start = Date.now();
    setElapsed(0);
    const id = setInterval(() => setElapsed(Date.now() - start), tickMs);
    return () => clearInterval(id);
  }, [active, tickMs]);

  return elapsed;
}
