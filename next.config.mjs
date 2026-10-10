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

import { RUTAS_ANTIGUAS_DE_IMAGENES } from './src/utils/rutas-antiguas-de-imagenes.mjs';

// ----------------------------------------------------------------------

const getFirebaseEnv = (...keys) =>
  keys
    .map((key) => process.env[key])
    .find(Boolean)
    ?.trim() ?? '';

const nextConfig = {
  trailingSlash: true,

  // El Admin SDK se carga TAL CUAL, sin empaquetar.
  //
  // firebase-admin resuelve media biblioteca con `require` dinamicos —segun el
  // entorno y las dependencias opcionales que encuentre—, y eso no sobrevive al
  // empaquetado: en Netlify, toda ruta que lo importara reventaba al CARGAR el
  // modulo, antes de ejecutar una sola linea del handler. Por fuera se veia como
  // un 500 seco en `/api/members`, `/api/cargos` y todo `/api/auth/*`, mientras
  // las rutas que no lo importan respondian normal.
  serverExternalPackages: ['firebase-admin', 'nodemailer', '@napi-rs/canvas'],

  // Las imágenes que cambiaron de carpeta: la ruta vieja lleva a la nueva.
  async redirects() {
    return RUTAS_ANTIGUAS_DE_IMAGENES.map((ruta) => ({ ...ruta, permanent: true }));
  },

  async headers() {
    return [
      // CABECERAS DE SEGURIDAD PARA TODAS LAS RUTAS.
      //
      // No habia ninguna: la aplicacion se podia incrustar en la pagina de un
      // tercero (clickjacking), el navegador adivinaba tipos de archivo y no se
      // forzaba HTTPS. `frame-ancestors 'self'` basta con la vista previa del
      // Designer, que es un iframe del MISMO origen. No se pone una CSP completa:
      // exige inventariar Firebase, MUI y los scripts en linea, y un error ahi
      // rompe la aplicacion entera; se hace aparte, con `Report-Only` primero.
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(self), microphone=(self), geolocation=(self)',
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
        ],
      },
      // LAS IMÁGENES FIJAS NO SE VUELVEN A PEDIR EN CADA VISITA. Sin esto Netlify
      // las servía con `max-age=0` y el navegador preguntaba por cada insignia
      // de cada pantalla. Se muestra la guardada mientras se comprueba por
      // detrás: no llevan huella en el nombre, así que una insignia cambiada
      // tiene que poder verse sin borrar nada a mano.
      //
      // Antes eran 24 horas sin preguntar: cambiar un número dorado en
      // `public/insignias/numeros-cintas` (mismo nombre de archivo) no se veía
      // hasta el día siguiente. Ahora 5 minutos en producción (el service
      // worker ya las sirve al instante) y, en desarrollo, siempre se pregunta
      // (`no-cache`: si no cambió, el servidor contesta 304 sin mandarla).
      ...['/insignias/:ruta*', '/sistema-ascenso/:ruta*', '/marca/:ruta*', '/iconos/:ruta*'].map(
        (source) => ({
          source,
          headers: [
            {
              key: 'Cache-Control',
              value:
                process.env.NODE_ENV === 'development'
                  ? 'no-cache'
                  : 'public, max-age=300, stale-while-revalidate=604800',
            },
          ],
        })
      ),
      {
        source: '/manifest.webmanifest',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/manifest+json; charset=utf-8',
          },
          {
            key: 'Cache-Control',
            value: 'public, max-age=3600',
          },
        ],
      },
    ];
  },

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
    // Evita que Turbopack tome el package-lock del directorio padre como raíz
    // y mezcle módulos durante las actualizaciones HMR.
    root: process.cwd(),
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
};

export default nextConfig;
