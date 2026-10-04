import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Killercoda gives each forwarded app port a hostname like
  // <workspace>-<port>.<region>.r.killercoda.com. Allow dev-only HMR requests
  // across Killercoda regions (for example, `papa` and `spca`).
  allowedDevOrigins: ["**.r.killercoda.com"],
};

export default nextConfig;
