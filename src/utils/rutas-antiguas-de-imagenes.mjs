// ----------------------------------------------------------------------
// LAS DIRECCIONES VIEJAS DE LAS IMÁGENES SIGUEN FUNCIONANDO.
//
// `public/` se reorganizó dos veces (logo → marca, icons → iconos, parches →
// insignias; después sistemaAscenso → sistema-ascenso, assets → plantilla,
// fonts → fuentes y los iconos de la app a app/), y lo que no se usaba salió a
// `docs/documentosNoUsados.zip`. Pero una dirección de imagen puede estar
// guardada fuera del código: el editor del mapa guarda la del emblema del
// Consejo Nacional, las casillas personalizadas llevan `/watermark.webp` como
// avatar, los buzones del chat viajan en las conversaciones, la app instalada
// recuerda sus iconos y hay enlaces ya enviados. Por eso cada ruta vieja que la
// aplicación usaba redirige, para siempre, a la nueva (`next.config.mjs`).
// No quitar reglas: rompería lo que ya está guardado. Lo concreto va antes que
// lo general.
// ----------------------------------------------------------------------

const CINTAS_Y_MEDALLAS = ['/parches/Cintas y medallas', '/parches/Cintas%20y%20medallas'];
const ACADEMIA = ['/sistemaAscenso/Academia Ministerial', '/sistemaAscenso/Academia%20Ministerial'];

const ARCHIVOS_DE_LA_APP = [
  'icon-192x192.png',
  'icon-512x512.png',
  'maskable-icon-192x192.png',
  'maskable-icon-512x512.png',
  'exploradores-del-rey-icono.ico',
  'pdf.worker.min.mjs',
];

export const RUTAS_ANTIGUAS_DE_IMAGENES = [
  ...CINTAS_Y_MEDALLAS.flatMap((viejo) => [
    { source: `${viejo}/cintas-perfil/:archivo`, destination: '/insignias/cintas/:archivo' },
    { source: `${viejo}/numeros-cintas/:archivo`, destination: '/insignias/numeros-cintas/:archivo' },
    { source: `${viejo}/medallas/:archivo`, destination: '/insignias/medallas/:archivo' },
    { source: `${viejo}/pines/:archivo`, destination: '/insignias/pines/:archivo' },
  ]),
  {
    source: '/parches/Generales/consejo-nacional-cuadrado.webp',
    destination: '/insignias/consejo-nacional.webp',
  },
  // Las divisiones van antes que la regla general de `/logo/`.
  ...['exploradores', 'navegantes', 'pioneros', 'seguidores'].map((division) => ({
    source: `/logo/${division}.png`,
    destination: `/marca/divisiones/${division}.png`,
  })),
  { source: '/logo/:archivo', destination: '/marca/:archivo' },
  { source: '/icons/seguidores.webp', destination: '/iconos/seguidores.webp' },
  { source: '/icons/lider-organizacional.webp', destination: '/iconos/lider-organizacional.webp' },

  // Segunda reorganización.
  ...ACADEMIA.map((viejo) => ({
    source: `${viejo}/:archivo`,
    destination: '/sistema-ascenso/academia-ministerial/:archivo',
  })),
  { source: '/sistemaAscenso/:ruta*', destination: '/sistema-ascenso/:ruta*' },
  {
    source: '/assets/documents/recursos-lideres/:archivo',
    destination: '/descargas/recursos-lideres/:archivo',
  },
  { source: '/assets/banner1.png', destination: '/marca/banner-acceso.png' },
  { source: '/assets/:ruta*', destination: '/plantilla/:ruta*' },
  { source: '/fonts/:archivo', destination: '/fuentes/:archivo' },
  ...ARCHIVOS_DE_LA_APP.map((archivo) => ({
    source: `/${archivo}`,
    destination: `/app/${archivo}`,
  })),
  { source: '/watermark.webp', destination: '/marca/watermark.webp' },

  // EXPLORA pasó a llamarse EXPEDITION (logotipo e isotipo nuevos). La portada
  // del Designer puede tener guardada la imagen vieja en una capa.
  { source: '/marca/explora-wordmark.webp', destination: '/marca/expedition-wordmark.webp' },
  {
    source: '/marca/explora-wordmark-light.webp',
    destination: '/marca/expedition-wordmark-light.webp',
  },
  { source: '/marca/explora-o-isotipo.webp', destination: '/marca/expedition-isotipo.webp' },
];
