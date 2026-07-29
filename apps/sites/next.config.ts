import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ["@cloudbridge/contracts"],
};

export default nextConfig;
