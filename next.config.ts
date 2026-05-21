import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Don't block production builds on lint errors (run lint separately in CI)
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Don't block production builds on type errors (run tsc separately in CI)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
