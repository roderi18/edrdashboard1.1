import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

// ----------------------------------------------------------------------
// EL DESPLEGABLE DE DIVISION, CON SUS ESCUDOS.
//
// Cada division tiene el suyo y se reconoce antes por la imagen que por el
// nombre. Vive aparte porque lo usan las dos pantallas de asistencia —la lista y
// el informe avanzado—: repetido en cada una, una acababa con escudos y la otra
// sin ellos.
//
// "Todos" es el valor `all` del desplegable y no una division: lleva el icono de
// Exploradores del Rey, que es la casa entera. Sin el, la unica opcion sin
// imagen seria justamente la primera y la lista arrancaria con un hueco.
// ----------------------------------------------------------------------

export const DIVISION_ICON_PATHS = {
  all: '/exploradores-del-rey-icono.ico',
  Liderazgo: '/assets/images/divisions/member/liderazgo-ico.png',
  Exploradores: '/assets/images/divisions/member/exploradores-ico.png',
  Seguidores: '/assets/images/divisions/member/seguidores-ico.png',
  Pioneros: '/assets/images/divisions/member/pioneros-ico.png',
  Navegantes: '/assets/images/divisions/member/navegantes-ico.png',
};

export const getDivisionIconSrc = (division) => DIVISION_ICON_PATHS[division] || '';

export function DivisionOptionContent({ option }) {
  const iconSrc = getDivisionIconSrc(option?.value);

  return (
    <Stack component="span" direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
      {iconSrc ? (
        <Box
          component="img"
          loading="lazy"
          decoding="async"
          alt=""
          src={iconSrc}
          sx={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        // Hueco del mismo tamaño: sin el, la opcion sin escudo empieza mas a la
        // izquierda que las demas y la lista se lee escalonada.
        <Box component="span" sx={{ width: 24, height: 24, flexShrink: 0 }} />
      )}
      <Box
        component="span"
        sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
      >
        {option?.label || 'Todos'}
      </Box>
    </Stack>
  );
}
