import type { NextConfig } from "next";

import { LEGACY_REDIRECTS } from "./src/lib/legacy-redirects";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [...LEGACY_REDIRECTS];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "flagcdn.com",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
