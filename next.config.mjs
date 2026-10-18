/** @type {import('next').NextConfig} */
const nextConfig = {
  // archiver uses dynamic requires; keep it out of the bundle
  serverExternalPackages: ['archiver'],
};

export default nextConfig;
