import Box from '@mui/material/Box';

// ----------------------------------------------------------------------
// EL TEMBLOR DE LO QUE ESPERA RESPUESTA.
//
// Un numerito rojo quieto entre otros iconos es facil de no ver, y lo que esta
// pendiente en un sitio que atienden varios es justo lo que nadie mira por dar
// por hecho que lo mira otro. Esto sacude un momento lo que envuelva —una foto,
// una campana, un boton— y lo deja quieto varios segundos: el temblor ocupa la
// primera parte del ciclo y el resto es espera, asi que llama la atencion sin
// convertirse en un parpadeo constante al lado de lo que se esta leyendo.
//
// SE QUEDA QUIETO para quien pide menos movimiento en su sistema: una animacion
// que no para es exactamente lo que ese ajuste viene a apagar.
//
// Envuelve, no dibuja: quien lo usa sigue poniendo su insignia y su contenido
// como los tenia. Conviene envolver la insignia JUNTO con lo que acompaña —si
// solo tiembla la foto, el numero se queda flotando en su sitio—.
// ----------------------------------------------------------------------

/**
 * @param activo      Si hay algo pendiente. En falso no anima nada.
 * @param cadaSegundos Cada cuanto se repite la sacudida.
 */
export function TemblorDeAviso({ activo = false, cadaSegundos = 5, children, sx, ...other }) {
  return (
    <Box
      sx={[
        { display: 'inline-flex', flexShrink: 0 },
        activo && {
          '@keyframes temblorDeAviso': {
            '0%, 14%, 100%': { transform: 'translateX(0) rotate(0deg)' },
            '2%, 6%, 10%': { transform: 'translateX(-2px) rotate(-7deg)' },
            '4%, 8%, 12%': { transform: 'translateX(2px) rotate(7deg)' },
          },
          animation: `temblorDeAviso ${cadaSegundos}s ease-in-out infinite`,
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...other}
    >
      {children}
    </Box>
  );
}
