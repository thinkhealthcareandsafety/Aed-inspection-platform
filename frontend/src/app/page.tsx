import type { Metadata } from 'next';
import { InspectionApp } from '@/components/public/InspectionApp';
import { HomeLanding, HOME_FAQS } from '@/components/site/HomeLanding';
import { JsonLd } from '@/components/site/content';
import { RESUME_PROBE } from '@/lib/resume-probe';
import { ORGANIZATION, SITE_NAME, SITE_URL, faqLd, ldGraph } from '@/lib/seo/site';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

/**
 * The public inspection: the app itself, with what it is and the way into
 * every guide rendered on the server beneath the form.
 */
export default function HomePage() {
  return (
    <>
      {/* Must come before the form in the HTML: it decides, before the form
          paints, whether a saved inspection is about to replace it. */}
      <script dangerouslySetInnerHTML={{ __html: RESUME_PROBE }} />
      <JsonLd
        data={ldGraph(
          {
            '@type': 'WebSite',
            '@id': `${SITE_URL}/#website`,
            name: SITE_NAME,
            alternateName: ['aedsmartx Inspector', 'AED SmartX'],
            url: SITE_URL,
            publisher: { '@id': ORGANIZATION['@id'] },
            inLanguage: ['en', 'hi'],
          },
          {
            '@type': 'WebApplication',
            name: SITE_NAME,
            url: SITE_URL,
            description:
              'A free AED inspection app. It films the readiness light and reads the serial number and pads and battery expiry dates with AI, then emails a PDF report.',
            applicationCategory: 'HealthApplication',
            operatingSystem: 'Any (runs in the browser)',
            browserRequirements: 'Requires a camera for photos and video.',
            inLanguage: ['en', 'hi'],
            isAccessibleForFree: true,
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR' },
            publisher: { '@id': ORGANIZATION['@id'] },
          },
          faqLd(HOME_FAQS),
        )}
      />
      <InspectionApp landing={<HomeLanding />} />
    </>
  );
}
