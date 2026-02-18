const fs = require("fs");
const path = require("path");

class CopySemverFunctionsPlugin {
  apply(compiler) {
    compiler.hooks.afterEmit.tap("CopySemverFunctionsPlugin", () => {
      const sourceDir = path.join(compiler.context, "node_modules", "semver", "functions");
      const targetDir = path.join(
        compiler.context,
        ".next",
        "server",
        "app",
        "api",
        "wardrobe",
        "blob",
        "node_modules",
        "semver",
        "functions"
      );

      if (!fs.existsSync(sourceDir)) return;

      fs.mkdirSync(targetDir, { recursive: true });
      fs.cpSync(sourceDir, targetDir, { recursive: true, force: true });
    });
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/wardrobe/blob": [
        "node_modules/sharp/**/*",
        "node_modules/@img/**/*",
        "node_modules/detect-libc/**/*",
        "node_modules/semver/**/*",
        "node_modules/semver/functions/**/*",
      ],
    },
  },
  webpack: (config, { isServer, dev }) => {
    if (isServer && !dev) {
      config.plugins.push(new CopySemverFunctionsPlugin());
    }

    return config;
  },
};

module.exports = nextConfig;
