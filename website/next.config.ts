import type { NextConfig } from "next";

import { productionSecurityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    root: process.cwd(),
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: productionSecurityHeaders.map(([key, value]) => ({ key, value })),
    }];
  },
};

export default nextConfig;
