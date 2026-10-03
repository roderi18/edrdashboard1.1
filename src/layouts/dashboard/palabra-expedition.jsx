import Box from '@mui/material/Box';

// ----------------------------------------------------------------------
// EL LOGOTIPO DE EXPEDITION EN EL MENÚ LATERAL (escritorio y móvil).
//
// El logotipo plano se lee igual sobre el menú claro y el oscuro, así que es
// una sola imagen para los dos temas.
//
// TAMAÑO Y POSICIÓN: se cambian AQUÍ, en `LOGO_DEL_MENU`, y valen para el menú
// de escritorio y el del móvil.
//  - ancho / alto: en píxeles. Mantén la proporción del archivo (480 × 303,
//    unos 1,58 de ancho por cada 1 de alto) o se verá con aire a los lados.
//  - horizontal: desplazamiento a la derecha desde el borde izquierdo del menú
//    (negativo, a la izquierda). 'centro' lo centra en el menú.
//  - arriba / abajo: espacio por encima y por debajo, en píxeles.
// ----------------------------------------------------------------------

export const LOGO_DEL_MENU = {
  ancho: 120,
  alto: 76,
  horizontal: 'centro',
  arriba: 16,
  abajo: 8,
};

const SRC = '/marca/expedition-logotipo.webp?v=3';

export function PalabraExpedition() {
  const { ancho, alto, horizontal, arriba, abajo } = LOGO_DEL_MENU;
  const centrado = horizontal === 'centro';

  return (
    <Box
      component="img"
      src={SRC}
      alt="EXPEDITION"
      width={ancho}
      height={alto}
      loading="eager"
      decoding="sync"
      fetchPriority="high"
      sx={{
        width: ancho,
        height: alto,
        display: 'block',
        objectFit: 'contain',
        mt: `${arriba}px`,
        mb: `${abajo}px`,
        ...(centrado ? { mx: 'auto' } : { ml: `${horizontal}px` }),
      }}
    />
  );
}
