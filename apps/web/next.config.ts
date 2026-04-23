import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  transpilePackages: ["@recruitment-os/types", "@recruitment-os/permissions"],
  webpack: (config) => {
    config.watchOptions = {
      ...config.watchOptions,
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.claude/worktrees/**",
        "**/.worktrees/**",
      ],
    };
    return config;
  },
};

const baseConfig = withNextIntl(nextConfig);

export default process.env.NODE_ENV === "production"
  ? withSentryConfig(baseConfig, {
      widenClientFileUpload: true,
      disableLogger: true,
      sourcemaps: {
        deleteSourcemapsAfterUpload: true,
      },
      silent: !process.env.CI,
    })
  : baseConfig;
