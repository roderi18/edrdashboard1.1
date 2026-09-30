// ----------------------------------------------------------------------
// LAS DIRECCIONES VIEJAS DE LAS IMÁGENES SIGUEN FUNCIONANDO.
//
// `public/` se reorganizó (logo → marca, icons → iconos, parches → insignias) y
// lo que no usa la aplicación salió a `docs/`. Pero una dirección de imagen puede
// estar guardada fuera del código: el editor del mapa guarda la del emblema del
// Consejo Nacional, los avatares de los buzones del chat viajan en las
// conversaciones y hay enlaces ya enviados. Por eso cada ruta vieja que la
// aplicación usaba redirige, para siempre, a la nueva (`next.config.mjs`).
// No renumerar ni quitar: rompería lo que ya está guardado.
// ----------------------------------------------------------------------

const CINTAS_Y_MEDALLAS = ['/parches/Cintas y medallas', '/parches/Cintas%20y%20medallas'];

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
];
