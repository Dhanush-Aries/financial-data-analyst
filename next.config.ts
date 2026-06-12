import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Needed for pdf-parse which uses require() and reads test data files
  webpack: (config, { isServer }) => {
    if (isServer) {
      // pdf-parse bundles test PDF data — exclude to prevent large bundle
      config.externals = config.externals || [];
      config.externals.push("canvas");
    }
    return config;
  },
  // Increase body size limit for file uploads
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
