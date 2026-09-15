'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { useTheme } from 'next-themes';
import { MotionConfig } from 'framer-motion';
import { Toaster } from 'sonner';
import { springSnappy } from '@/lib/motion';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );
  const { resolvedTheme } = useTheme();

  return (
    <QueryClientProvider client={queryClient}>
      {/* One default transition for anything that doesn't specify its own, and
          honour the OS "reduce motion" setting rather than animating anyway. */}
      <MotionConfig transition={springSnappy} reducedMotion="user">
        {children}
        <Toaster
          position="top-right"
          theme={resolvedTheme === 'light' ? 'light' : 'dark'}
          toastOptions={{
            style: {
              background: 'hsl(var(--card))',
              border: '1px solid hsl(var(--border))',
              color: 'hsl(var(--card-foreground))',
            },
          }}
        />
        <ReactQueryDevtools initialIsOpen={false} />
      </MotionConfig>
    </QueryClientProvider>
  );
}
