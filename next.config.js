/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/wardrobe/blob": ["node_modules/sharp/**/*", "node_modules/@img/**/*"],
    },
  },
};

module.exports = nextConfig;
