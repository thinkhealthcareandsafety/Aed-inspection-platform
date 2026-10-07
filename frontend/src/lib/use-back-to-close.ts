'use client';

import { useEffect, useRef } from 'react';

/**
 * The phone's back button closes the sheet that is open, the way every app
 * on the phone behaves, instead of leaving the site with the sheet still up.
 *
 * Opening the sheet adds one history entry for the same page. Back pops it
 * and closes the sheet; closing the sheet any other way (its own button, a
 * choice made in it) takes the entry back out, so the history is left as it
 * was found. For a sheet that is mounted while open and unmounted to close.
 */
export function useBackToClose(onClose: () => void): void {
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const marker = `sheet-${Math.random().toString(36).slice(2)}`;
    let pushed = false;
    let poppedByBack = false;
    const onPop = () => {
      poppedByBack = true;
      close.current();
    };
    // A tick later, so a mount React immediately undoes (as it does in
    // development) never touches the history at all.
    const timer = window.setTimeout(() => {
      // Keep the router's own state on the entry, so a back here is, to it,
      // a step to the same page.
      window.history.pushState({ ...(window.history.state ?? {}), __sheet: marker }, '');
      pushed = true;
      window.addEventListener('popstate', onPop);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('popstate', onPop);
      if (pushed && !poppedByBack && window.history.state?.__sheet === marker) window.history.back();
    };
  }, []);
}
