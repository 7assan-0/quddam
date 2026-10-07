import type { NextConfig } from "next";
import { browserSecurityHeaders, cspImageOrigins } from "./src/lib/security/browser-headers";

// Fail before build/start on malformed header configuration; never echo values.
cspImageOrigins(process.env.CSP_IMAGE_ORIGINS);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Read-only TV screens should not include the development toolbar launcher.
  devIndicators: false,
  poweredByHeader: false,
  allowedDevOrigins: ["127.0.0.1"],
  // E2E runs share an 8 GiB runner with PostgreSQL and browser contexts.
  // Evict persisted compiler data in test dev servers; production is unchanged.
  experimental: process.env.E2E_DATABASE_URL ? { turbopackMemoryEviction: "full" } : undefined,
  async headers() { return [{ source: "/:path*", headers: browserSecurityHeaders(process.env) }, { source: "/api/:path*", headers: [
    { key: "Cache-Control", value: "private, no-store" },
  ] }, { source: "/display/:id", headers: [
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Cache-Control", value: "private, no-store" },
  ] }, { source: "/api/display/:path*", headers: [
    { key: "Referrer-Policy", value: "no-referrer" },
  ] }, { source: "/social/display/:id", headers: [
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Cache-Control", value: "private, no-store" },
  ] }, { source: "/api/social/:id/display", headers: [
    { key: "Referrer-Policy", value: "no-referrer" },
  ] }, { source: "/letter-network/display/:id", headers: [
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Cache-Control", value: "private, no-store" },
  ] }, { source: "/api/letter-network/:id/display", headers: [
    { key: "Referrer-Policy", value: "no-referrer" },
  ] }, { source: "/survey-show/display/:id", headers: [
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Cache-Control", value: "private, no-store" },
  ] }, { source: "/api/survey-show/:path*", headers: [
    { key: "Referrer-Policy", value: "no-referrer" },
    { key: "Cache-Control", value: "private, no-store" },
  ] }, { source: "/secret-word/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/api/secret-word/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/bluff/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/api/bluff/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/ranked/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/api/ranked/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/lightning/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/api/lightning/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/ordering/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/api/ordering/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/court/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }, { source: "/api/court/:path*", headers: [{key:"Referrer-Policy",value:"no-referrer"},{key:"Cache-Control",value:"private, no-store"}] }]; },
};

export default nextConfig;
