import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';

import { DashboardContent } from 'src/layouts/dashboard';

import {
  FilasDeTabla,
  TablaOrganizacionalCargando,
  ListaOrganizacionalCargando,
  FormularioOrganizacionalCargando,
} from 'src/sections/common/nivel-organizacional-cargando';

// ----------------------------------------------------------------------
// ESQUELETOS DE PANTALLA PARA LOS `loading.jsx` DE TODA LA APLICACIÓN.
//
// Mismo motivo que en los niveles organizacionales: al pulsar una entrada del
// menú, la pantalla se quedaba quieta (o con el splash de todo el panel) hasta
// que llegaba la siguiente. El App Router precarga el `loading.jsx` de cada ruta
// y lo enseña en el mismo clic; cada uno tiene la forma de lo que viene.
// ----------------------------------------------------------------------

// Los de los niveles sirven igual para cualquier lista, alta o pestaña.
export const PantallaDeListaCargando = ListaOrganizacionalCargando;
export const PantallaDeFormularioCargando = FormularioOrganizacionalCargando;
export const ContenidoDeListaCargando = TablaOrganizacionalCargando;
export const FilasDeListaCargando = FilasDeTabla;

/** Filas en esqueleto DENTRO de un `<TableBody>` (en vez de "Cargando..."). */
export function FilasDeTablaCargando({ filas = 5, columnas = 4 }) {
  return Array.from({ length: filas }, (_, fila) => (
    <TableRow key={fila}>
      {Array.from({ length: columnas }, (__, columna) => (
        <TableCell key={columna}>
          <Skeleton variant="text" width={columna === 0 ? '70%' : '50%'} />
        </TableCell>
      ))}
    </TableRow>
  ));
}

function Encabezado() {
  return (
    <Box sx={{ mb: { xs: 3, md: 5 } }}>
      <Skeleton variant="text" width={260} height={44} />
      <Skeleton variant="text" width={180} />
    </Box>
  );
}

/** Tienda: rejilla de tarjetas de producto. */
export function PantallaDeCuadriculaCargando({ tarjetas = 8 }) {
  return (
    <DashboardContent>
      <Encabezado />
      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(3, 1fr)',
            lg: 'repeat(4, 1fr)',
          },
        }}
      >
        {Array.from({ length: tarjetas }, (_, indice) => (
          <Card key={indice} sx={{ p: 1 }}>
            <Skeleton variant="rounded" sx={{ width: 1, height: 'auto', aspectRatio: '1 / 1' }} />
            <Stack spacing={1} sx={{ p: 1.5 }}>
              <Skeleton variant="text" width="80%" />
              <Skeleton variant="text" width="40%" />
            </Stack>
          </Card>
        ))}
      </Box>
    </DashboardContent>
  );
}

/** Detalle (producto, pedido): imagen o resumen a un lado, datos al otro. */
export function PantallaDeDetalleCargando() {
  return (
    <DashboardContent>
      <Encabezado />
      <Box
        sx={{
          gap: 3,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '7fr 5fr' },
        }}
      >
        <Skeleton variant="rounded" sx={{ width: 1, height: 'auto', aspectRatio: '4 / 3' }} />
        <Stack spacing={2}>
          <Skeleton variant="text" width="70%" height={40} />
          <Skeleton variant="text" width="30%" height={32} />
          <Skeleton variant="rounded" height={120} />
          <Skeleton variant="rounded" height={48} />
        </Stack>
      </Box>
    </DashboardContent>
  );
}

/** Chat: lista de conversaciones y la conversación abierta. */
export function PantallaDeChatCargando() {
  return (
    <DashboardContent maxWidth={false} sx={{ display: 'flex', flex: '1 1 auto' }}>
      <Card sx={{ flex: '1 1 auto', display: 'flex', minHeight: 480 }}>
        <Stack
          spacing={2}
          sx={{
            p: 2,
            width: 320,
            flexShrink: 0,
            borderRight: 1,
            borderColor: 'divider',
            display: { xs: 'none', md: 'flex' },
          }}
        >
          <Skeleton variant="rounded" height={40} />
          {Array.from({ length: 7 }, (_, indice) => (
            <Stack key={indice} direction="row" spacing={1.5} alignItems="center">
              <Skeleton variant="circular" width={44} height={44} />
              <Stack sx={{ flex: 1 }}>
                <Skeleton variant="text" width="60%" />
                <Skeleton variant="text" width="85%" />
              </Stack>
            </Stack>
          ))}
        </Stack>

        <Stack spacing={2} sx={{ p: 2, flex: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="circular" width={40} height={40} />
            <Skeleton variant="text" width={160} />
          </Stack>
          <Box sx={{ flex: 1 }} />
          {[55, 35, 60, 40].map((ancho, indice) => (
            <Skeleton
              key={indice}
              variant="rounded"
              height={40}
              sx={{ width: `${ancho}%`, alignSelf: indice % 2 ? 'flex-end' : 'flex-start' }}
            />
          ))}
          <Skeleton variant="rounded" height={52} />
        </Stack>
      </Card>
    </DashboardContent>
  );
}

/** Calendario: la cuadrícula del mes. */
export function PantallaDeCalendarioCargando() {
  return (
    <DashboardContent>
      <Encabezado />
      <Card sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" sx={{ mb: 2 }}>
          <Skeleton variant="rounded" width={160} height={36} />
          <Skeleton variant="rounded" width={220} height={36} />
        </Stack>
        <Box sx={{ gap: 1, display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {Array.from({ length: 35 }, (_, indice) => (
            <Skeleton key={indice} variant="rounded" height={88} />
          ))}
        </Box>
      </Card>
    </DashboardContent>
  );
}

/** EXPLORA Designer: bloques a un lado, vista previa al otro (sin marco). */
export function EditorCargando() {
  return (
    <Box sx={{ gap: 3, display: 'grid', gridTemplateColumns: { xs: '1fr', md: '5fr 7fr' } }}>
      <Stack spacing={2}>
        {Array.from({ length: 6 }, (_, indice) => (
          <Skeleton key={indice} variant="rounded" height={64} />
        ))}
      </Stack>
      <Skeleton variant="rounded" sx={{ minHeight: 520 }} />
    </Box>
  );
}

export function PantallaDeEditorCargando() {
  return (
    <DashboardContent maxWidth="xl">
      <Encabezado />
      <EditorCargando />
    </DashboardContent>
  );
}
