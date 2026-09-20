import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const isDevelopment = process.env.NODE_ENV === "development";
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ""} https://cdn.paddle.com https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://picsum.photos https://*.alicdn.com https://www.google-analytics.com https://www.facebook.com https://analytics.tiktok.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.paddle.com https://*.paddle.dev https://www.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.facebook.com https://analytics.tiktok.com",
  "frame-src https://*.paddle.com https://*.paddle.dev https://www.googletagmanager.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "manifest-src 'self'",
  ...(!isDevelopment ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  { key: "X-Frame-Options", value: "DENY" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.alicdn.com",
        pathname: "/**",
      },
    ],
  },
};

export default withNextIntl(nextConfig);
