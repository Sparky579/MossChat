import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: process.cwd(),
  async headers() {
    return [{
      source: "/sw.js",
      headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }],
    }];
  },
};

export default nextConfig;
