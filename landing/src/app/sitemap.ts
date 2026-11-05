import { SITE_URL } from '@/lib/site';

import type { MetadataRoute } from 'next';

const PAGES = { ru: `${SITE_URL}/`, en: `${SITE_URL}/en` } as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: PAGES.ru,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
      alternates: { languages: PAGES },
    },
    {
      url: PAGES.en,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: { languages: PAGES },
    },
  ];
}
