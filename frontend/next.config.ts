import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://127.0.0.1:8001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/search", destination: `${BACKEND_URL}/search` },
      { source: "/fetch", destination: `${BACKEND_URL}/fetch` },
      { source: "/expand", destination: `${BACKEND_URL}/expand` },
      { source: "/modules", destination: `${BACKEND_URL}/modules` },
      {
        source: "/modules/declarations",
        destination: `${BACKEND_URL}/modules/declarations`,
      },
      { source: "/feedback", destination: `${BACKEND_URL}/feedback` },
    ];
  },
};

export default nextConfig;
