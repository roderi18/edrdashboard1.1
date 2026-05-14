import { CONFIG } from 'src/global-config';

// ----------------------------------------------------------------------

const THEME_COLOR = '#00A76F';

export default function manifest() {
  return {
    id: '/',
    name: CONFIG.appName,
    short_name: 'Exploradores',
    description: 'Sistema de gestion para Exploradores del Rey.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: THEME_COLOR,
    categories: ['productivity', 'education'],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/maskable-icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/maskable-icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
