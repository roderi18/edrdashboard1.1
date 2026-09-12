import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import MenuList from '@mui/material/MenuList';
import Typography from '@mui/material/Typography';

import { Iconify } from 'src/components/iconify';

// ----------------------------------------------------------------------
// LOS ESTADOS DE UN PEDIDO, EN DOS SITIOS Y CON UNA SOLA LISTA.
//
// Arriba como fila de pastillas y a la izquierda como columna: son la MISMA
// eleccion, asi que salen del mismo sitio. Escritas dos veces, el dia que se
// añada un estado se añade en una y no en la otra, y la cuenta de una pastilla
// deja de cuadrar con la de su fila.
//
// El color y el icono van con el estado, no con el sitio donde se pinta: un
// pedido cancelado es rojo en la fila, en la columna y en la tabla.
//
// Los dibujos son DE LINEA. En relleno, cinco colores macizos repetidos cuarenta
// veces convierten la tabla en un semaforo y el ojo deja de leer los datos: el
// color sigue diciendo lo que decia, lo que baja de peso es el dibujo. Estan en
// el paquete del proyecto, no cargados por internet.
// ----------------------------------------------------------------------

// "Todos" va en el VERDE DE LA CASA, no en el cian de `info`. El cian no es un
// color del proyecto —la identidad es el verde de Exploradores— y encima
// competia con los estados, que si usan el color para decir algo: amarillo lo
// que espera, verde lo hecho, rojo lo que se cayo.
export const ESTADOS_DE_ORDEN = [
  { value: 'all', label: 'Todos', color: 'primary', icono: 'custom:estado-todos' },
  { value: 'pending', label: 'Pendiente', color: 'warning', icono: 'custom:estado-pendiente' },
  {
    value: 'completed',
    label: 'Completado',
    color: 'success',
    icono: 'custom:estado-completado',
  },
  { value: 'cancelled', label: 'Cancelado', color: 'error', icono: 'custom:estado-cancelado' },
  {
    value: 'refunded',
    label: 'Reembolsado',
    color: 'default',
    icono: 'custom:estado-reembolsado',
  },
];

/** Cuantos pedidos hay en cada estado. "Todos" es el total, no un estado mas. */
export const contarPorEstado = (ordenes = []) =>
  ESTADOS_DE_ORDEN.reduce(
    (cuenta, estado) => ({
      ...cuenta,
      [estado.value]:
        estado.value === 'all'
          ? ordenes.length
          : ordenes.filter((orden) => orden.status === estado.value).length,
    }),
    {}
  );

export function OrderStatusNav({ valor, cuentas, onCambiar, onContactar, sx }) {
  return (
    <Stack spacing={3} sx={sx}>
      {/* MARGEN AL BORDE Y ENTRE BLOQUES. Las filas llegaban hasta el filo de la
          tarjeta y el encabezado quedaba pegado a la primera: la columna parecia
          un bloque apretado al lado de una lista que si respira. */}
      <Card sx={{ p: 2.5 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              display: 'flex',
              borderRadius: 1.5,
              alignItems: 'center',
              justifyContent: 'center',
              color: 'primary.main',
              bgcolor: 'primary.lighter',
            }}
          >
            <Iconify icon="custom:estado-todos" width={22} />
          </Box>

          <Box>
            <Typography variant="subtitle1">Mis órdenes</Typography>

            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Consulta el estado de tus pedidos.
            </Typography>
          </Box>
        </Stack>

        <MenuList sx={{ p: 0, gap: 0.5, display: 'flex', flexDirection: 'column' }}>
          {ESTADOS_DE_ORDEN.map((estado) => (
            <MenuItem
              key={estado.value}
              selected={valor === estado.value}
              onClick={() => onCambiar?.(estado.value)}
              sx={{ px: 1.5, py: 1, gap: 1.5, borderRadius: 1 }}
            >
              <Iconify
                icon={estado.icono}
                width={20}
                sx={{
                  color: estado.color === 'default' ? 'text.secondary' : `${estado.color}.main`,
                }}
              />

              <Box sx={{ flexGrow: 1, typography: 'body2' }}>{estado.label}</Box>

              {/* La cuenta en gris y no en color: lo que tiene que saltar a la
                  vista es el estado elegido, no cuantos hay de cada uno. */}
              <Box sx={{ typography: 'caption', color: 'text.disabled' }}>
                {cuentas?.[estado.value] ?? 0}
              </Box>
            </MenuItem>
          ))}
        </MenuList>
      </Card>

      {/* EL SOPORTE, DEBAJO Y NO DENTRO DE LA LISTA. Es lo que se busca cuando
          la lista NO ha resuelto la duda, asi que no compite con ella. */}
      {/* Con `spacing` en vez de margenes sueltos: el icono, el titulo, el texto
          y el boton estaban pegados unos a otros y la tarjeta parecia un bloque
          apretado al lado de la lista, que si respira. */}
      <Card sx={{ p: 2.5 }}>
        <Stack spacing={1.5} alignItems="center" textAlign="center">
          <Iconify icon="solar:headphones-round-bold" width={32} sx={{ color: 'text.disabled' }} />

          <Typography variant="subtitle2">¿Necesitas ayuda?</Typography>

          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Escríbenos si algo de tu pedido no cuadra.
          </Typography>

          <Button
            fullWidth
            size="small"
            variant="contained"
            onClick={onContactar}
            startIcon={<Iconify icon="solar:chat-round-dots-bold" />}
            sx={{ mt: 0.5 }}
          >
            Contactar soporte
          </Button>
        </Stack>
      </Card>
    </Stack>
  );
}
