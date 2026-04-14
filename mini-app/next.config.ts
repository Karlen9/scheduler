import createNextIntlPlugin from 'next-intl/plugin';

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  async rewrites() {
    const apiUrl = process.env.API_URL || 'http://localhost:8080';
    return [
      {
        source: '/test/client',
        destination: '/',
      },
      {
        source: '/test/client/:path*',
        destination: '/:path*',
      },
      {
        source: '/test/admin',
        destination: '/admin',
      },
      {
        source: '/test/admin/:path*',
        destination: '/admin/:path*',
      },
      {
        source: '/api/:path*',
        destination: `${apiUrl}/api/:path*`,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin();
export default withNextIntl(nextConfig);
