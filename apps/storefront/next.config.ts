import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  devIndicators: false,
  transpilePackages: ["@cloudbridge/contracts"],
  experimental: {
    useTypeScriptCli: true,
  },
};

export default nextConfig;
