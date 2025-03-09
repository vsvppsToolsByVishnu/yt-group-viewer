/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Disable TypeScript type checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
  // Configure allowed image domains
  images: {
    domains: [
      'i.ytimg.com',       // YouTube thumbnails
      'yt3.ggpht.com',     // YouTube channel avatars
      'yt3.googleusercontent.com', // Additional YouTube avatars
      'youtube.com',       // YouTube main domain
      'www.youtube.com'    // YouTube www subdomain
    ],
  },
};

module.exports = nextConfig; 