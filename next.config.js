/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/wardrobe/blob": ["node_modules/sharp/**/*"],
    },
  },
  webpack(config, { isServer }) {
    if (isServer && Array.isArray(config.externals)) {
      config.externals = config.externals.filter(
        (external) =>
          !(typeof external === "string" && external === "sharp")
      );
    }
    return config;
  },
};

module.exports = nextConfig;
