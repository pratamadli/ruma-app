import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@ruma/ui', '@ruma/types', '@ruma/validation'],
};

export default nextConfig;
