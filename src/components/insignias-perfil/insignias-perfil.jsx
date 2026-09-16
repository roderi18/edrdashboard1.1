import Box from '@mui/material/Box';

import { obtenerNumeroDorado, obtenerInsigniaPerfil } from './catalogo';

// Cada entrada puede ser el id del catálogo o `{ id, numero }`. Así la pantalla
// que la usa solo decide cuáles mostrar; el tamaño, el centrado y los recursos
// viven en este módulo y se mantienen iguales en toda la aplicación.
export function InsigniasPerfil({
  sx,
  insignias = [],
  columnas = 3,
  rowGap = 0,
  columnGap = 0,
  tamanoNumero = '17%',
  maxWidth = 300,
}) {
  const elementos = insignias
    .map((entrada) => {
      const opciones = typeof entrada === 'string' ? { id: entrada } : entrada;
      const insignia = obtenerInsigniaPerfil(opciones?.id);

      return insignia ? { ...opciones, insignia } : null;
    })
    .filter(Boolean);

  if (!elementos.length) return null;

  return (
    <Box
      sx={[
        {
          mx: 'auto',
          width: '100%',
          display: 'grid',
          maxWidth,
          rowGap,
          columnGap,
          gridTemplateColumns: `repeat(${columnas}, minmax(0, 1fr))`,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {elementos.map(({ id, numero, insignia, tamanoNumero: tamanoPropio }, index) => {
        const numeroSrc = obtenerNumeroDorado(numero);
        const ultimaSola = index === elementos.length - 1 && elementos.length % columnas === 1;

        return (
          <Box
            key={`${id}-${index}`}
            title={insignia.nombre}
            sx={{
              width: 1,
              lineHeight: 0,
              position: 'relative',
              gridColumn: ultimaSola ? Math.ceil(columnas / 2) : 'auto',
            }}
          >
            <Box
              component="img"
              src={insignia.src}
              alt={insignia.nombre}
              sx={{ width: 1, height: 'auto', display: 'block' }}
            />

            {numeroSrc && (
              <Box
                component="img"
                src={numeroSrc}
                alt={`Número ${numero}`}
                sx={{
                  top: '50%',
                  left: '50%',
                  width: tamanoPropio ?? tamanoNumero,
                  height: 'auto',
                  position: 'absolute',
                  transform: 'translate(-50%, -52%)',
                }}
              />
            )}
          </Box>
        );
      })}
    </Box>
  );
}
