/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true,
  },
  experimental: {
    serverComponentsExternalPackages: ["pdf.js-extract"],
    serverActions: {
      bodySizeLimit: "16mb",
    },
  },
};

export default nextConfig;
