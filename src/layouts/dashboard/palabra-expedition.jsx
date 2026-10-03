import Box from '@mui/material/Box';

// ----------------------------------------------------------------------
// LA PALABRA EXPEDITION DEL MENÚ LATERAL (escritorio y móvil).
//
// Texto azul marino sobre el menú claro y blanco sobre el oscuro. Con "menú en
// blanco" el fondo es el del tema, así que en el tema OSCURO también es oscuro:
// elegir la imagen solo por ese ajuste dejaba la palabra azul marino sobre azul
// marino, casi invisible. Van las dos imágenes y el tema decide cuál se ve, sin
// parpadeo mientras se averigua.
// ----------------------------------------------------------------------

const OSCURA = '/marca/expedition-wordmark.webp?v=1';
const BLANCA = '/marca/expedition-wordmark-light.webp?v=1';

export function PalabraExpedition({ isNavLight, width, height }) {
  const imagen = (src, sx) => (
    <Box
      component="img"
      src={src}
      alt="EXPEDITION"
      width={width}
      height={height}
      loading="eager"
      decoding="sync"
      fetchPriority="high"
      sx={[
        { width, height, display: 'block', objectFit: 'contain', objectPosition: 'left center' },
        sx,
      ]}
    />
  );

  // Menú oscuro en los dos temas: siempre la blanca.
  if (!isNavLight) return imagen(BLANCA);

  return (
    <>
      {imagen(OSCURA, (theme) => theme.applyStyles('dark', { display: 'none' }))}
      {imagen(BLANCA, (theme) => ({
        display: 'none',
        ...theme.applyStyles('dark', { display: 'block' }),
      }))}
    </>
  );
}
