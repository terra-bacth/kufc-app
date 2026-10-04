import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Killercoda gives each forwarded app port a hostname like
  // <workspace>-<port>.spca.r.killercoda.com. Allow its dev-only HMR requests.
  allowedDevOrigins: ["*.spca.r.killercoda.com"],
};

export default nextConfig;
