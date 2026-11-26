import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `/` → `/my-time` at the routing layer (a redirect() inside page.tsx trips the
  // Cache Components prerender validation in dev).
  async redirects() {
    return [{ source: "/", destination: "/my-time", permanent: false }];
  },
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
