/** @type {import('next').NextConfig} */
const nextConfig = {
  // Linting runs through `nx lint example-next`; don't double-lint in builds.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
