import type { Metadata } from 'next';
import { Geist, Geist_Mono, Noto_Sans_Devanagari } from 'next/font/google';
import { ThemeProvider } from '@/components/theme-provider';
import { Providers } from './providers';
import './globals.css';

const geistSans = Geist({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono', display: 'swap' });
// Geist has no Devanagari, so Hindi falls through to this. Not preloaded: its
// unicode-range means English visitors never download it.
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-deva',
  display: 'swap',
  preload: false,
});

const DESCRIPTION =
  'Check your AED is ready to save a life in 3 minutes. Photograph six things, AI reads every label, and a PDF report is emailed to you. Free, from aedsmartx by Think Health.';

export const metadata: Metadata = {
  metadataBase: new URL('https://inspector.aedsmartx.com'),
  title: {
    default: 'AED SmartX Inspector — Free AI AED inspection',
    template: '%s | AED SmartX Inspector',
  },
  description: DESCRIPTION,
  applicationName: 'AED SmartX Inspector',
  // The "a" from the aedsmartx wordmark, in its brand red.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/brand/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/brand/apple-touch-icon.png',
  },
  openGraph: {
    title: 'AED SmartX Inspector',
    description: DESCRIPTION,
    siteName: 'AED SmartX Inspector',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${devanagari.variable}`}
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
