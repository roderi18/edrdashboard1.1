'use client';

import useSWR from 'swr';
import { onSnapshot } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import {
  ordenarPines,
  MAXIMO_PINES,
  PINES_POR_FILA,
  disponerPinesEnFilas,
} from 'src/utils/pines-perfil.mjs';

import { fetcher } from 'src/lib/axios';
import { referenciaDePines } from 'src/services/pines-miembros-apply';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useOrdenDePines } from './use-orden-de-cintas';
import { useInsigniasPersonalizadas } from './use-insignias-personalizadas';

// ----------------------------------------------------------------------
// PINES DEL PERFIL.
//
// Los hermanos de cintas y medallas: se leen de `pines_miembros/{idMiembros}`,
// salen en el orden global que se arrastra en EXPLORA Designer y, de momento,
// solo los pone a mano el Administrador Global con el MISMO lápiz de las cintas,
// en su pestaña "Pines". En el perfil van ENCIMA de las cintas, en una fila
// centrada, cada uno del ancho de una cinta.
// El catálogo es la carpeta `public/parches/Cintas y medallas/pines` más los
// añadidos en el Designer (`/api/insignias/pines`).
// ----------------------------------------------------------------------

const VACIO = [];

function useLecturaDelCatalogo() {
  const { data, error } = useSWR(
    typeof window !== 'undefined'
      ? ['/api/insignias/pines/', { baseURL: window.location.origin }]
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000, keepPreviousData: true }
  );

  // Los añadidos en EXPLORA Designer (Firestore) van detrás de los de la carpeta.
  const { pines: personalizados } = useInsigniasPersonalizadas();
  const deCarpeta = data?.pines ?? VACIO;
  const pines = useMemo(
    () => (personalizados.length ? [...deCarpeta, ...personalizados] : deCarpeta),
    [deCarpeta, personalizados]
  );

  return { pines, cargando: !data && !error };
}

/** El catálogo de pines, una vez por sesión y compartido entre tarjetas. */
export function useCatalogoDePines() {
  return useLecturaDelCatalogo().pines;
}

// Como cintas y medallas: los pines tardan en llegar y, al estar ENCIMA de las
// cintas, al aparecer empujaban todo hacia abajo. Se recuerda cuántos tenía la
// última vez para guardar ese hueco; quien no tenía pines no ve ninguno.
const claveDeCantidad = (id) => `erd-pines-cantidad-${id}`;

const cantidadRecordada = (id) => {
  try {
    return Number(window.localStorage.getItem(claveDeCantidad(id))) || 0;
  } catch {
    return 0;
  }
};

const recordarCantidad = (id, cantidad) => {
  try {
    if (cantidad) window.localStorage.setItem(claveDeCantidad(id), String(cantidad));
    else window.localStorage.removeItem(claveDeCantidad(id));
  } catch {
    // Ventana privada: sin esqueleto la próxima vez, nada más.
  }
};

// Los pines son apaisados (~3:2): el hueco reserva ese alto antes de cargar.
const PROPORCION = '3 / 2';

const anchoDeCasilla = (theme, espacioHorizontal) =>
  `calc((100% - ${theme.spacing(espacioHorizontal * (PINES_POR_FILA - 1))}) / ${PINES_POR_FILA})`;

/** El hueco de los pines mientras cargan; solo si esa persona tenía pines. */
export function EsqueletoDePines({ idMiembros, sx, maxWidth = 300, espacioHorizontal = 0.3 }) {
  const id = String(Number(idMiembros) || '');
  const [esperados] = useState(() =>
    id && typeof window !== 'undefined' ? Math.min(cantidadRecordada(id), MAXIMO_PINES) : 0
  );

  if (!esperados) return null;

  return (
    <Box
      aria-busy="true"
      sx={[
        {
          mx: 'auto',
          width: 1,
          maxWidth,
          display: 'flex',
          justifyContent: 'center',
          columnGap: espacioHorizontal,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {Array.from({ length: esperados }, (_, indice) => (
        <Skeleton
          key={indice}
          variant="rounded"
          sx={(theme) => ({
            height: 'auto',
            aspectRatio: PROPORCION,
            width: anchoDeCasilla(theme, espacioHorizontal),
          })}
        />
      ))}
    </Box>
  );
}

/** Los pines guardados de un miembro, en vivo. Sin permiso o sin red, ninguno. */
export function usePinesDelMiembro(idMiembros) {
  const id = String(Number(idMiembros) || '');
  const [leidos, setLeidos] = useState({ idLeido: '', pines: [] });

  useEffect(() => {
    if (!id) return undefined;

    return onSnapshot(
      referenciaDePines(id),
      (instantanea) => setLeidos({ idLeido: id, pines: instantanea.data()?.pines ?? [] }),
      (error) => {
        console.error('[pines] no se pudieron leer', error);
        setLeidos({ idLeido: id, pines: [] });
      }
    );
  }, [id]);

  return { cargando: leidos.idLeido !== id, pines: leidos.pines };
}

/** Un pin, con un hueco gris mientras llega la imagen. */
export function ImagenDePin({ pin, pequena = false, sx }) {
  const [cargada, setCargada] = useState(false);
  const src = pequena ? pin.srcPequena || pin.src : pin.src;

  return (
    <Box sx={[{ position: 'relative', width: 1 }, ...(Array.isArray(sx) ? sx : [sx])]}>
      {!cargada && (
        <Skeleton
          variant="rounded"
          sx={{ position: 'absolute', inset: 0, height: 1, width: 1, borderRadius: 1 }}
        />
      )}
      <Box
        component="img"
        src={src}
        alt={pin.nombre}
        loading="lazy"
        decoding="async"
        draggable={false}
        ref={(nodo) => {
          if (nodo?.complete && nodo.naturalWidth && !cargada) setCargada(true);
        }}
        onLoad={() => setCargada(true)}
        onError={() => setCargada(true)}
        sx={{
          width: 1,
          display: 'block',
          aspectRatio: cargada ? 'auto' : PROPORCION,
          objectFit: 'contain',
          opacity: cargada ? 1 : 0,
          transition: 'opacity 0.2s',
        }}
      />
    </Box>
  );
}

// `maxWidth` y el hueco, los MISMOS que `CintasDeMiembro`: cada pin mide lo que
// una cinta y la fila queda centrada encima de ellas.
export function PinesDeMiembro({
  idMiembros,
  sx,
  maxWidth = 300,
  espacioHorizontal = 0.3,
  espacioVertical = 0.3,
}) {
  const { pines: catalogo, cargando: cargandoCatalogo } = useLecturaDelCatalogo();
  const orden = useOrdenDePines();
  const { cargando: cargandoPines, pines } = usePinesDelMiembro(idMiembros);
  const cargando = cargandoPines || cargandoCatalogo;
  const id = String(Number(idMiembros) || '');

  const porId = useMemo(() => new Map(catalogo.map((pin) => [pin.id, pin])), [catalogo]);
  const filas = useMemo(
    () => disponerPinesEnFilas(cargando ? [] : ordenarPines(pines, catalogo, orden)),
    [cargando, pines, catalogo, orden]
  );
  const visibles = filas.reduce((total, fila) => total + fila.length, 0);

  useEffect(() => {
    if (id && !cargando) recordarCantidad(id, visibles);
  }, [id, cargando, visibles]);

  if (cargando) {
    return (
      <EsqueletoDePines
        idMiembros={id}
        sx={sx}
        maxWidth={maxWidth}
        espacioHorizontal={espacioHorizontal}
      />
    );
  }

  if (!filas.length) return null;

  return (
    <Box
      sx={[
        {
          mx: 'auto',
          width: 1,
          maxWidth,
          display: 'flex',
          flexDirection: 'column',
          rowGap: espacioVertical,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {filas.map((fila) => (
        <Box
          key={fila.join('|')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            columnGap: espacioHorizontal,
          }}
        >
          {fila.map((idPin) => {
            const pin = porId.get(idPin);

            return (
              <Tooltip key={idPin} arrow title={pin.nombre}>
                <Box sx={(theme) => ({ width: anchoDeCasilla(theme, espacioHorizontal) })}>
                  <ImagenDePin pin={pin} pequena />
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      ))}
    </Box>
  );
}

// ----------------------------------------------------------------------

const normalizarBusqueda = (texto) =>
  String(texto ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();

/**
 * La pestaña "Pines" del diálogo de las cintas: el catálogo en el orden global,
 * para marcar y desmarcar. El estado lo lleva el diálogo, que guarda cintas,
 * medallas y pines con el mismo botón.
 */
export function SelectorDePines({ catalogo = [], elegidos, onCambiar }) {
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const termino = normalizarBusqueda(busqueda);

    return termino
      ? catalogo.filter((pin) => normalizarBusqueda(pin.nombre).includes(termino))
      : catalogo;
  }, [busqueda, catalogo]);

  const alternar = (idPin) => {
    const siguientes = new Set(elegidos);

    if (siguientes.has(idPin)) siguientes.delete(idPin);
    // Como mucho tres: en el perfil no se ve ninguno más.
    else if (siguientes.size >= MAXIMO_PINES) {
      toast.info(`Como máximo ${MAXIMO_PINES} pines. Quita uno para poner otro.`);
      return;
    } else siguientes.add(idPin);

    onCambiar(siguientes);
  };

  return (
    <>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Elegidos: {elegidos.size} de {MAXIMO_PINES}. En el perfil van encima de las cintas,
        centrados, en el orden global de EXPLORA Designer.
      </Typography>

      <TextField
        size="small"
        label="Buscar pin"
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.target.value)}
        sx={{ mb: 2, width: 1, maxWidth: 300 }}
        slotProps={{
          input: { startAdornment: <Iconify icon="eva:search-fill" sx={{ mr: 1 }} /> },
        }}
      />

      <Box
        sx={{
          gap: 1,
          display: 'grid',
          gridTemplateColumns: {
            xs: 'repeat(3, minmax(0, 1fr))',
            sm: 'repeat(5, minmax(0, 1fr))',
            md: 'repeat(8, minmax(0, 1fr))',
          },
        }}
      >
        {visibles.map((pin) => {
          const activo = elegidos.has(pin.id);

          return (
            <Box
              key={pin.id}
              role="checkbox"
              aria-checked={activo}
              tabIndex={0}
              onClick={() => alternar(pin.id)}
              onKeyDown={(evento) => {
                if (evento.key === ' ' || evento.key === 'Enter') {
                  evento.preventDefault();
                  alternar(pin.id);
                }
              }}
              title={pin.nombre}
              sx={(theme) => ({
                p: 0.75,
                minWidth: 0,
                cursor: 'pointer',
                borderRadius: 1,
                backgroundColor: activo
                  ? theme.vars.palette.primary.lighter
                  : theme.vars.palette.background.paper,
                border: `2px solid ${
                  activo ? theme.vars.palette.primary.main : theme.vars.palette.divider
                }`,
                ...theme.applyStyles('dark', {
                  backgroundColor: activo
                    ? theme.vars.palette.primary.darker
                    : theme.vars.palette.background.paper,
                }),
              })}
            >
              <ImagenDePin pin={pin} pequena />
              <Typography
                variant="caption"
                sx={{ mt: 0.5, display: 'block', lineHeight: 1.25, overflowWrap: 'anywhere' }}
              >
                {pin.nombre}
              </Typography>
            </Box>
          );
        })}
        {!visibles.length && (
          <Typography
            variant="body2"
            sx={{ py: 3, color: 'text.secondary', textAlign: 'center', gridColumn: '1 / -1' }}
          >
            {catalogo.length
              ? 'No encontramos pines con esa búsqueda.'
              : 'Todavía no hay imágenes en la carpeta de pines.'}
          </Typography>
        )}
      </Box>
    </>
  );
}
