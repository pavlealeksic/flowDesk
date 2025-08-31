/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
    typedRoutes: true,
  },
  transpilePackages: ['@flow-desk/shared'],
  images: {
    domains: ['avatars.githubusercontent.com'],
  },
  async rewrites() {
    return [
      {
        source: '/api/plugins/:path*',
        destination: '/api/plugin-registry/:path*',
      },
    ];
  },
}

// Bundle analyzer
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
})

module.exports = withBundleAnalyzer(nextConfig)
