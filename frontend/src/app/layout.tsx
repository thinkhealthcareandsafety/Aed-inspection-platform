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

const TITLE = 'Free AED Inspection App: Check Your AED in 3 Minutes';
const DESCRIPTION =
  'Free AED inspection on your phone. AI checks the readiness light, pads and battery expiry and the serial number, then emails you a PDF report.';

export const metadata: Metadata = {
  metadataBase: new URL('https://inspector.aedsmartx.com'),
  title: {
    default: TITLE,
    template: '%s | AED SmartX Inspector',
  },
  description: DESCRIPTION,
  applicationName: 'AED SmartX Inspector',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  // Card type only: a page without its own twitter titles falls back to its
  // og: tags, rather than inheriting the home page's.
  twitter: { card: 'summary_large_image' },
  // The "a" from the aedsmartx wordmark, in its brand red.
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/brand/icon-192.png', type: 'image/png', sizes: '192x192' },
    ],
    apple: '/brand/apple-touch-icon.png',
  },
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: 'AED SmartX Inspector',
    type: 'website',
    url: '/',
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
