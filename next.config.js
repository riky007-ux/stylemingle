/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverExternalPackages: ["sharp"],
  },
};

module.exports = nextConfig;
