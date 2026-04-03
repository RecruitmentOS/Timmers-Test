import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@recruitment-os/types", "@recruitment-os/permissions"],
};

export default nextConfig;
