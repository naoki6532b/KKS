const port = process.env.PORT || "3000";
const isProd = process.env.NODE_ENV === "production";

const forwardedDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const codespaceName = process.env.CODESPACE_NAME;

const codespacesHost =
  codespaceName && forwardedDomain
    ? `${codespaceName}-${port}.${forwardedDomain}`
    : null;

// 開発環境（Codespaces等）専用のオリジン。本番ではCSRF緩和になるため含めない。
const devOrigins = [
  "localhost:3000",
  "127.0.0.1:3000",
  "*.app.github.dev",
  ...(forwardedDomain ? [`*.${forwardedDomain}`] : []),
  ...(codespacesHost ? [codespacesHost] : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: devOrigins,
  ...(isProd
    ? {}
    : {
        experimental: {
          serverActions: {
            allowedOrigins: devOrigins,
          },
        },
      }),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
