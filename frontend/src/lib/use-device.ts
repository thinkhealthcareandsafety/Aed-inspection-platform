'use client';

import { useEffect, useState } from 'react';

/**
 * True on a computer with a mouse or trackpad — where "Take the photo"
 * opens a file browser instead of a camera, and the person is better off
 * carrying on with their phone. False until mounted, so server and first
 * client render agree.
 */
export function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(hover: hover) and (pointer: fine)');
    const update = () => setDesktop(query.matches);
    update();
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return desktop;
}

/**
 * Whether the browser believes it has a network. A stairwell or basement
 * drops signal without warning, and an upload that fails there reads as the
 * app breaking unless something says the network went.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return online;
}
