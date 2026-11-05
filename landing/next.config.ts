import createNextIntlPlugin from 'next-intl/plugin';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: { root: process.cwd() },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
