/**
 * The landing page's sample report. Rendered from the real report generator
 * (backend/src/scripts/sample-report.ts), so what is shown is exactly what a
 * customer receives.
 */
export const SAMPLE_PAGES = ['/sample-report/page-1.webp', '/sample-report/page-2.webp'];
export const SAMPLE_PDF = '/sample-report/aed-inspect-sample-report.pdf';

/** Warms the first page, so the sheet opens onto paper, not a grey box. */
export function preloadSampleReport(): void {
  try {
    const img = new window.Image();
    img.decoding = 'async';
    img.src = SAMPLE_PAGES[0];
  } catch {
    // Nothing to warm; the sheet shows a placeholder while it loads.
  }
}
