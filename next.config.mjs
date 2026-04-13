const port = process.env.PORT || "3000";

const forwardedDomain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
const codespaceName = process.env.CODESPACE_NAME;

const codespacesHost =
  codespaceName && forwardedDomain
    ? `${codespaceName}-${port}.${forwardedDomain}`
    : null;

/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "127.0.0.1:3000",
    "*.app.github.dev",
    ...(forwardedDomain ? [`*.${forwardedDomain}`] : []),
    ...(codespacesHost ? [codespacesHost] : []),
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "127.0.0.1:3000",
        "*.app.github.dev",
        ...(forwardedDomain ? [`*.${forwardedDomain}`] : []),
        ...(codespacesHost ? [codespacesHost] : []),
      ],
    },
  },
};

export default nextConfig;