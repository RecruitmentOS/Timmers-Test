import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@recruitment-os/types", "@recruitment-os/permissions"],
};

export default withSentryConfig(withNextIntl(nextConfig), {
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: {
    deleteSourcemapsAfterUpload: true,
  },
  silent: !process.env.CI,
});
