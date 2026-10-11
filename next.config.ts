import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // foto progres proyek dikirim lewat server action
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
};

export default nextConfig;
