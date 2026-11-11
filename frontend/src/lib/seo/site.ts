import type { Metadata } from 'next';

/**
 * The facts every public page states about the site and who runs it, kept in
 * one place so titles, structured data and the sitemap never disagree.
 */
export const SITE_URL = 'https://inspector.aedsmartx.com';
export const SITE_NAME = 'AED SmartX Inspector';

/** When the guides were last gone through. Shown on each page, and used as
 *  the sitemap's last-modified date: bump it when the content changes. */
export const CONTENT_UPDATED = '2026-11-11';

export const ORGANIZATION = {
  '@type': 'Organization',
  '@id': `${SITE_URL}/#organization`,
  name: 'Think Health',
  alternateName: 'Think Healthcare and Safety',
  url: 'https://thinkhealth.in',
  logo: `${SITE_URL}/brand/icon-512.png`,
  sameAs: ['https://aedsmartx.com', 'https://thinkhealth.in'],
} as const;

export function absoluteUrl(path: string): string {
  return path === '/' ? SITE_URL : `${SITE_URL}${path}`;
}

/** A breadcrumb trail, as search engines read it. */
export function breadcrumbLd(trail: { name: string; path: string }[]) {
  return {
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((t, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: t.name,
      item: absoluteUrl(t.path),
    })),
  };
}

export function faqLd(faqs: { q: string; a: string }[]) {
  return {
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** A guide, credited to the company that wrote it. */
export function articleLd(opts: { title: string; description: string; path: string; image?: string }) {
  return {
    '@type': 'Article',
    headline: opts.title,
    description: opts.description,
    mainEntityOfPage: absoluteUrl(opts.path),
    image: opts.image ? absoluteUrl(opts.image) : `${SITE_URL}/opengraph-image`,
    datePublished: CONTENT_UPDATED,
    dateModified: CONTENT_UPDATED,
    author: { '@id': ORGANIZATION['@id'] },
    publisher: { '@id': ORGANIZATION['@id'] },
    inLanguage: 'en',
  };
}

/** Several schema.org nodes as one graph, so the organisation is named once. */
export function ldGraph(...nodes: object[]) {
  return { '@context': 'https://schema.org', '@graph': [ORGANIZATION, ...nodes] };
}

/**
 * A public page's metadata. Setting openGraph on a page replaces the whole
 * object it would inherit, share image included, so the image is named
 * again here; and twitter is given the page's own title, not the home page's.
 */
export function pageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  type?: 'website' | 'article';
}): Metadata {
  const images = [{ url: '/opengraph-image', width: 1200, height: 630, alt: SITE_NAME }];
  return {
    title: { absolute: opts.title },
    description: opts.description,
    alternates: { canonical: opts.path },
    openGraph: {
      title: opts.title,
      description: opts.description,
      url: opts.path,
      siteName: SITE_NAME,
      type: opts.type ?? 'website',
      images,
    },
    twitter: { card: 'summary_large_image', title: opts.title, description: opts.description, images },
  };
}
