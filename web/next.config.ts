import type { NextConfig } from "next";

import { LEGACY_REDIRECTS } from "./src/lib/legacy-redirects";

const nextConfig: NextConfig = {
  output: "standalone",
  // Pages rendered on demand live in a bounded in-memory LRU, never on disk.
  // The region tree is ~55,000 pages at ~440 KB each, and the file-system
  // cache has no eviction: on 2026-10-27 one overnight crawl wrote 21 GB into
  // the container, filled the volume Postgres lives on, and took sign-in down.
  // Build-time pages are unaffected — the cache still reads them from disk.
  cacheMaxMemorySize: 256 * 1024 * 1024,
  experimental: {
    isrFlushToDisk: false,
  },
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
