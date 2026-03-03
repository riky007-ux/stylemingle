/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/wardrobe/blob": [
        "node_modules/sharp/**/*",
        "node_modules/@img/**/*",
      ],
      "/api/dev/migrate": [
        "./drizzle/**",
      ],
      "/api/dev/premium": [
        "./drizzle/**",
      ],
    },
  },
};

module.exports = nextConfig;
