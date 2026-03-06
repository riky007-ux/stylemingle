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
        "./drizzle/meta/_journal.json",
        "./drizzle/*.sql",
      ],
      "/api/dev/premium": [
        "./drizzle/**",
        "./drizzle/meta/_journal.json",
        "./drizzle/*.sql",
      ],
      "/api/dev/schema": [
        "./drizzle/**",
        "./drizzle/meta/_journal.json",
        "./drizzle/*.sql",
      ],
    },
  },
};

module.exports = nextConfig;
