/**
 * Static Exports in Next.js
 *
 * 1. Set `isStaticExport = true` in `next.config.{mjs|ts}`.
 * 2. This allows `generateStaticParams()` to pre-render dynamic routes at build time.
 *
 * For more details, see:
 * https://nextjs.org/docs/app/building-your-application/deploying/static-exports
 *
 * NOTE: Remove all "generateStaticParams()" functions if not using static exports.
 */

// ----------------------------------------------------------------------

const getFirebaseEnv = (...keys) => keys.map((key) => process.env[key]).find(Boolean)?.trim() ?? '';

const nextConfig = {
  trailingSlash: true,

  env: {
    NEXT_PUBLIC_FIREBASE_API_KEY: getFirebaseEnv(
      'NEXT_PUBLIC_FIREBASE_API_KEY',
      'FIREBASE_API_KEY'
    ),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: getFirebaseEnv(
      'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
      'NEXT_PUBLIC_FIREBASE_AUTHDOMAIN',
      'FIREBASE_AUTH_DOMAIN',
      'FIREBASE_AUTHDOMAIN'
    ),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: getFirebaseEnv(
      'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
      'NEXT_PUBLIC_FIREBASE_PROJECTID',
      'FIREBASE_PROJECT_ID',
      'FIREBASE_PROJECTID'
    ),
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: getFirebaseEnv(
      'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
      'NEXT_PUBLIC_FIREBASE_STORAGEBUCKET',
      'FIREBASE_STORAGE_BUCKET',
      'FIREBASE_STORAGEBUCKET'
    ),
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: getFirebaseEnv(
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
      'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDERID',
      'FIREBASE_MESSAGING_SENDER_ID',
      'FIREBASE_MESSAGING_SENDERID'
    ),
    NEXT_PUBLIC_FIREBASE_APP_ID: getFirebaseEnv(
      'NEXT_PUBLIC_FIREBASE_APP_ID',
      'NEXT_PUBLIC_FIREBASE_APPID',
      'FIREBASE_APP_ID',
      'FIREBASE_APPID'
    ),
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: getFirebaseEnv(
      'NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID',
      'NEXT_PUBLIC_FIREBASE_MEASUREMENTID',
      'FIREBASE_MEASUREMENT_ID',
      'FIREBASE_MEASUREMENTID'
    ),
  },

  // Without --turbopack (next dev)
  webpack(config) {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });

    return config;
  },

  // With --turbopack (next dev --turbopack)
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
};

export default nextConfig;

