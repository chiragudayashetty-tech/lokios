/** @type {import('next').NextConfig} */
const nextConfig = {
  // Each deploy gets its own service-worker cache, so old JS chunks never mix with new ones
  env: { NEXT_PUBLIC_BUILD_ID: (process.env.VERCEL_GIT_COMMIT_SHA || String(Date.now())).slice(0, 12) },
  // PWA manifest headers
  async headers() {
    return [
      {
        source: '/manifest.json',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=86400',
          },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/habits',
        destination: '/quests',
        permanent: true,
      },
    ]
  },
};

export default nextConfig;
