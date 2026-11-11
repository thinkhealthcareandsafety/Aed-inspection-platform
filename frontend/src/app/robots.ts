import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/seo/site';

/** Search engines and AI assistants get the landing page and the guides;
 *  staff pages and the API stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/login', '/settings', '/reports', '/inspection', '/api/'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
