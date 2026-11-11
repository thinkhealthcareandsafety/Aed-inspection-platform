import type { MetadataRoute } from 'next';
import { MODEL_GUIDES } from '@/lib/seo/models';
import { GUIDES } from '@/lib/seo/guides';
import { CONTENT_UPDATED, absoluteUrl } from '@/lib/seo/site';

/** Every public page: the app's landing, the model guides and the guides.
 *  The rest of the site sits behind a login. */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date(`${CONTENT_UPDATED}T00:00:00Z`);
  return [
    { url: absoluteUrl('/'), lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: absoluteUrl('/aed'), lastModified, changeFrequency: 'monthly', priority: 0.8 },
    ...MODEL_GUIDES.map((g) => ({
      url: absoluteUrl(`/aed/${g.slug}`),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    { url: absoluteUrl('/guides'), lastModified, changeFrequency: 'monthly', priority: 0.7 },
    ...GUIDES.map((g) => ({
      url: absoluteUrl(`/guides/${g.slug}`),
      lastModified,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
  ];
}
