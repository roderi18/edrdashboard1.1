'use client';

import { useSearchParams } from 'next/navigation';

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Skeleton from '@mui/material/Skeleton';

import { esCarpetaDePremios } from 'src/utils/insignias-de-premios.mjs';

import { DashboardContent } from 'src/layouts/dashboard';

import {
  TARJETA_INSIGNIA,
  HUECO_DE_INSIGNIAS,
  COLUMNAS_DE_INSIGNIAS,
} from './awards-insignia-item';

// ----------------------------------------------------------------------
// ESQUELETO DE LA PESTAÑA DE PREMIOS.
//
// Tiene la forma de lo que va a salir, para que al llegar los datos nada se
// mueva. Antes pintaba siempre filas de lista, pero la pestaña abre en
// cuadrícula y cada carpeta es distinta:
//   - 'raiz': resumen de progreso y las tarjetas de los programas.
//   - 'carpetas': tarjetas de carpeta (divisiones, grupos, adiestramientos).
//   - 'insignias': las tarjetas cuadradas de las carpetas con insignia.
// Con la vista de lista elegida, filas. `soloContenido`: sin el buscador, para
// cuando el buscador ya está pintado.
// ----------------------------------------------------------------------

/** Qué forma tiene la carpeta `idCarpeta` (vacía = la raíz). */
export const varianteDeCarpeta = (idCarpeta) =>
  !idCarpeta ? 'raiz' : esCarpetaDePremios(idCarpeta) ? 'insignias' : 'carpetas';

const COLUMNAS_DE_CARPETAS = {
  xs: 'repeat(1, 1fr)',
  sm: 'repeat(2, 1fr)',
  md: 'repeat(3, 1fr)',
  lg: 'repeat(4, 1fr)',
};

function Buscador({ conMigas }) {
  return (
    <Stack spacing={2.5}>
      {/* Las migas ("Premios • …") solo salen dentro de una carpeta. */}
      {conMigas && <Skeleton width={220} height={20} sx={{ mt: -1 }} />}
      <Stack direction="row" spacing={1} alignItems="center">
        <Skeleton
          variant="rounded"
          sx={{ height: 54, flex: 1, maxWidth: { xs: 'none', md: 260 } }}
        />
        <Skeleton variant="rounded" sx={{ height: 54, width: 54, flexShrink: 0 }} />
        <Box sx={{ flex: 1, display: { xs: 'none', md: 'block' } }} />
        {/* El botón lista/cuadrícula, que en pantalla pequeña no sale. */}
        <Skeleton
          variant="rounded"
          sx={{ height: 54, width: 98, flexShrink: 0, display: { xs: 'none', sm: 'block' } }}
        />
      </Stack>
    </Stack>
  );
}

function Resumen() {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5}>
      <Card sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ px: 2.5, pt: 2, pb: 1.5 }}>
          <Skeleton variant="circular" width={36} height={36} />
          <Box sx={{ flex: 1 }}>
            <Skeleton width="45%" />
            <Skeleton width="70%" height={14} />
          </Box>
        </Stack>
        <Stack direction="row" spacing={3} alignItems="center" sx={{ px: 2.5, py: 2 }}>
          <Skeleton variant="circular" width={48} height={48} />
          <Box sx={{ width: 140 }}>
            <Skeleton height={14} />
            <Skeleton width="60%" />
          </Box>
          <Box sx={{ width: 120 }}>
            <Skeleton height={14} />
            <Skeleton width="60%" />
          </Box>
        </Stack>
      </Card>
      <Card sx={{ flex: 1, minWidth: 0, px: 2.5, py: 2 }}>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
          <Skeleton variant="circular" width={32} height={32} />
          <Skeleton width="35%" />
        </Stack>
        <Skeleton />
        <Skeleton width="80%" sx={{ mb: 1.5 }} />
        <Skeleton variant="rounded" height={36} />
      </Card>
    </Stack>
  );
}

// Como `FileManagerFolderItem`: icono arriba, nombre y detalle debajo.
function TarjetaDeCarpeta() {
  return (
    <Card variant="outlined" sx={{ p: 2.5, bgcolor: 'transparent' }}>
      <Skeleton variant="rounded" width={36} height={36} sx={{ mb: 1.5 }} />
      <Skeleton width="70%" />
      <Skeleton width="45%" height={16} />
    </Card>
  );
}

// Como `AwardsInsigniaItem`: mismo alto, insignia redonda y dos líneas de nombre.
function TarjetaDeInsignia() {
  return (
    <Card
      variant="outlined"
      sx={{
        pt: 4,
        pb: 1.5,
        px: 1,
        gap: 0.75,
        display: 'flex',
        alignItems: 'center',
        flexDirection: 'column',
        bgcolor: 'transparent',
        height: TARJETA_INSIGNIA.alto,
      }}
    >
      <Skeleton
        variant="circular"
        width={TARJETA_INSIGNIA.insignia}
        height={TARJETA_INSIGNIA.insignia}
      />
      <Skeleton width="80%" height={14} />
    </Card>
  );
}

function Filas({ cuantas }) {
  return (
    <Stack spacing={2}>
      <Skeleton variant="rounded" sx={{ height: 56, borderRadius: 1.5 }} />
      {Array.from({ length: cuantas }, (_, indice) => (
        <Skeleton key={indice} variant="rounded" sx={{ height: 76, borderRadius: 2 }} />
      ))}
    </Stack>
  );
}

export function AwardsManagerSkeleton({ soloContenido = false, variante = 'raiz', lista = false }) {
  const renderContenido = () => {
    if (lista) return <Filas cuantas={variante === 'raiz' ? 2 : 5} />;

    if (variante === 'insignias') {
      return (
        <Box
          sx={{
            display: 'grid',
            gap: HUECO_DE_INSIGNIAS,
            gridTemplateColumns: COLUMNAS_DE_INSIGNIAS,
          }}
        >
          {Array.from({ length: 18 }, (_, indice) => (
            <TarjetaDeInsignia key={indice} />
          ))}
        </Box>
      );
    }

    return (
      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: COLUMNAS_DE_CARPETAS }}>
        {/* En la raíz solo hay dos programas: Sistema de Ascenso y Academia. */}
        {Array.from({ length: variante === 'raiz' ? 2 : 8 }, (_, indice) => (
          <TarjetaDeCarpeta key={indice} />
        ))}
      </Box>
    );
  };

  return (
    <Stack spacing={2.5} aria-busy="true">
      {!soloContenido && <Buscador conMigas={variante !== 'raiz'} />}
      {variante === 'raiz' && <Resumen />}
      {renderContenido()}
    </Stack>
  );
}

// El contenedor de la pestaña dentro de la ficha (ver `AwardsManagerView`): sin
// el relleno que ya pone la ficha y, en pantalla grande, algo más ancho. Aquí
// para que el esqueleto y la vista midan exactamente lo mismo.
export const SX_PREMIOS_EN_FICHA = {
  pb: 0,
  px: { lg: 0 },
  mx: { xl: -3 },
  width: { xl: 'auto' },
};

/**
 * La pestaña entera mientras llega el miembro (`loading.jsx` y la página): mira
 * la carpeta de la dirección para pintar la forma que va a salir.
 */
export function AwardsTabSkeleton() {
  const searchParams = useSearchParams();

  return (
    <DashboardContent sx={SX_PREMIOS_EN_FICHA}>
      <AwardsManagerSkeleton variante={varianteDeCarpeta(searchParams?.get('folder'))} />
    </DashboardContent>
  );
}
