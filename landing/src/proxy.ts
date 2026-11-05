import createMiddleware from 'next-intl/middleware';

import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Skip internals, files with an extension (icon.svg, robots.txt, sitemap.xml) and OG images.
  matcher: ['/((?!api|_next|_vercel|.*opengraph-image|.*\\..*).*)'],
};
