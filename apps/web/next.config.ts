import createNextIntlPlugin from "next-intl/plugin";
import type { NextConfig } from "next";

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@recruitment-os/types", "@recruitment-os/permissions"],
};

export default withNextIntl(nextConfig);
