/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Lint is not part of the Phase 1 toolchain; `npm run typecheck` is the gate.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
