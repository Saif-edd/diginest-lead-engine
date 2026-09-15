import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingIncludes: {
    "/api/audit": [
      "./node_modules/playwright-core/browsers.json",
      "./node_modules/playwright-core/lib/**",
      "./node_modules/@sparticuz/chromium/build/**",
      "./node_modules/@sparticuz/chromium/bin/**",
    ],
  },
};

export default nextConfig;
