import type { NextConfig } from 'next';

/** Railway (or other) API origin, e.g. https://ruma-app-production.up.railway.app */
const apiProxyTarget = process.env.API_PROXY_TARGET?.replace(/\/$/, '');

const nextConfig: NextConfig = {
  transpilePackages: ['@ruma/ui', '@ruma/types', '@ruma/validation'],
  async rewrites() {
    // Browser calls same-origin `/v1/*` so the refresh cookie is first-party on Vercel.
    // Cross-site cookies (vercel.app → railway.app) are unreliable and break session on reload.
    if (!apiProxyTarget) {
      return [];
    }
    return [
      {
        source: '/v1/:path*',
        destination: `${apiProxyTarget}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
