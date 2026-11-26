import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// A14: next-intl without URL prefixes; config in src/i18n/request.ts.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

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
  // cacheComponents / partialPrefetching are off: on Vercel the partial-prerender resume
  // left dynamic Suspense boundaries unresolved (signed-in pages stuck on skeletons,
  // response never closed). Nothing in Tempo uses "use cache"; plain dynamic SSR is enough.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
