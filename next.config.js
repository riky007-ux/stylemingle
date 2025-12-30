/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // enable server actions (used by API routes)
    serverActions: true,
  },
  images: {
    // allow all HTTPS images; adjust if you know the specific domains you need
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  reactStrictMode: true,
};

module.exports = nextConfig;
