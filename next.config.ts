import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Client-side prototype (localStorage): Cache Components / partial prefetching add friction without benefit.
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
