/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/wardrobe/blob": [
        "node_modules/sharp/**/*",
        "node_modules/@img/**/*",
        "node_modules/detect-libc/**/*",
      ],
    },
  },
};

module.exports = nextConfig;
