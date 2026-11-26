import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Slack avatars (users.list / OIDC picture)
    remotePatterns: [{ protocol: "https", hostname: "*.slack-edge.com" }],
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
