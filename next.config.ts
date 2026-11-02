import type { NextConfig } from "next";
const api = process.env.API_INTERNAL_URL || "http://127.0.0.1:5225";
const config: NextConfig = {
  output: "standalone",
  allowedDevOrigins: ["127.0.0.1"],
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: api + "/api/:path*" },
      { source: "/hubs/:path*", destination: api + "/hubs/:path*" },
    ];
  },
  async redirects() {
    return ["/mvp", "/stack", "/roadmap"].map((source) => ({
      source,
      destination: "/platform",
      permanent: true,
    }));
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'" +
              (process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "") +
              "; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' ws: wss:; worker-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://checkout.stripe.com",
          },
        ],
      },
    ];
  },
};
export default config;
