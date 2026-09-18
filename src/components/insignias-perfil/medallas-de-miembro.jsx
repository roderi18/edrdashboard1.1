'use client';

import useSWR from 'swr';
import { onSnapshot } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { keyframes } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import {
  MAXIMO_MEDALLAS,
  ordenarMedallas,
  desfaseDeMedalla,
  MEDALLAS_POR_FILA,
  EFECTOS_BRILLO_MEDALLA,
  configuracionDeMedallas,
  disponerMedallasEnFilas,
  normalizarBrilloMedalla,
  EFECTOS_MOVIMIENTO_MEDALLA,
  normalizarMovimientoMedalla,
} from 'src/utils/medallas-perfil.mjs';

import { fetcher } from 'src/lib/axios';
import { referenciaDeMedallas } from 'src/services/medallas-miembros-apply';

import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useOrdenDeMedallas } from './use-orden-de-cintas';

// ----------------------------------------------------------------------
// MEDALLAS DEL PERFIL.
//
// Las hermanas de las cintas (`cintas-de-miembro.jsx`): se leen de
// `medallas_miembros/{idMiembros}`, salen en el orden global que se arrastra en
// EXPLORA Designer y, de momento, solo las pone a mano el Administrador Global
// con el MISMO lápiz de las cintas, en su pestaña "Medallas".
// El catálogo es la carpeta `public/parches/Cintas y medallas/medallas`: una
// imagen nueva ahí aparece aquí sin tocar código (`/api/insignias/medallas`).
// ----------------------------------------------------------------------

const VACIO = [];

/** El catálogo de medallas, una vez por sesión y compartido entre tarjetas. */
export function useCatalogoDeMedallas() {
  const { data } = useSWR(
    typeof window !== 'undefined'
      ? ['/api/insignias/medallas/', { baseURL: window.location.origin }]
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000, keepPreviousData: true }
  );

  return data?.medallas ?? VACIO;
}

/**
 * Las medallas guardadas de un miembro, en vivo. `cargando` hasta la primera
 * lectura; sin permiso o sin red, ninguna.
 */
export function useMedallasDelMiembro(idMiembros) {
  const id = String(Number(idMiembros) || '');
  const [leidas, setLeidas] = useState({ idLeido: '', medallas: [] });

  useEffect(() => {
    if (!id) return undefined;

    return onSnapshot(
      referenciaDeMedallas(id),
      (instantanea) => setLeidas({ idLeido: id, medallas: instantanea.data()?.medallas ?? [] }),
      (error) => {
        // Sin permiso o sin red el perfil sigue pintándose, solo que sin medallas.
        console.error('[medallas] no se pudieron leer', error);
        setLeidas({ idLeido: id, medallas: [] });
      }
    );
  }, [id]);

  return { cargando: leidas.idLeido !== id, medallas: leidas.medallas };
}

// ----------------------------------------------------------------------
// LOS EFECTOS DE LA MEDALLA.
//
// La imagen es una sola pieza (cinta + medallón), así que se pinta en DOS capas
// recortadas de la misma imagen: la cinta hasta el 56 % del alto y el medallón
// desde el 55 %. Ese 1 % de solape tapa la costura cuando el medallón se mece.
// Cada capa se anima por su lado; el brillo va dentro de la capa del medallón y
// se enmascara con la propia imagen, así que solo toca el metal, nunca el fondo.
//
// Casi todos los movimientos tienen PAUSA dentro del ciclo: una medalla que no
// para de moverse cansa; una que de vez en cuando se mece, parece viva.
// ----------------------------------------------------------------------

export const OPCIONES_MOVIMIENTO_MEDALLA = [
  [EFECTOS_MOVIMIENTO_MEDALLA.SOPLO, 'Soplo de aire'],
  [EFECTOS_MOVIMIENTO_MEDALLA.PENDULO, 'Medallón en péndulo'],
  [EFECTOS_MOVIMIENTO_MEDALLA.BALANCEO, 'Balanceo completo'],
  [EFECTOS_MOVIMIENTO_MEDALLA.LATIDO, 'Latido del medallón'],
  [EFECTOS_MOVIMIENTO_MEDALLA.NINGUNO, 'Sin movimiento'],
];

export const OPCIONES_BRILLO_MEDALLA = [
  [EFECTOS_BRILLO_MEDALLA.DESTELLO, 'Destello que cruza'],
  [EFECTOS_BRILLO_MEDALLA.RESPLANDOR, 'Resplandor dorado'],
  [EFECTOS_BRILLO_MEDALLA.CENTELLEO, 'Centelleo de estrellas'],
  [EFECTOS_BRILLO_MEDALLA.NINGUNO, 'Sin brillo'],
];

const CORTE = 55;

// Ráfagas: quieta, un golpe de aire, se asienta, quieta otra vez.
const rafagaPieza = keyframes`
  0%, 38%, 100% { transform: rotate(0deg); }
  46% { transform: rotate(-2.2deg); }
  54% { transform: rotate(1.6deg); }
  62% { transform: rotate(-0.9deg); }
  70% { transform: rotate(0.4deg); }
  78% { transform: rotate(0deg); }
`;

// El medallón llega un poco tarde y se mece más: cuelga de la cinta.
const rafagaMedallon = keyframes`
  0%, 42%, 100% { transform: rotate(0deg); }
  51% { transform: rotate(-4deg); }
  60% { transform: rotate(3.2deg); }
  69% { transform: rotate(-1.8deg); }
  78% { transform: rotate(0.8deg); }
  86% { transform: rotate(0deg); }
`;

const pendulo = keyframes`
  0%, 100% { transform: rotate(0deg); }
  12% { transform: rotate(4.5deg); }
  26% { transform: rotate(-3.6deg); }
  40% { transform: rotate(2.4deg); }
  52% { transform: rotate(-1.2deg); }
  62% { transform: rotate(0deg); }
`;

const balanceo = keyframes`
  0%, 100% { transform: rotate(-1.8deg); }
  50% { transform: rotate(1.8deg); }
`;

const latido = keyframes`
  0%, 30%, 100% { transform: scale(1); }
  8% { transform: scale(1.045); }
  16% { transform: scale(1); }
  22% { transform: scale(1.03); }
`;

const destello = keyframes`
  0%, 55% { background-position: 170% 0; }
  85%, 100% { background-position: -70% 0; }
`;

const resplandor = keyframes`
  0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 214, 102, 0)) brightness(1); }
  50% { filter: drop-shadow(0 0 5px rgba(255, 214, 102, 0.85)) brightness(1.12); }
`;

const centelleo = keyframes`
  0%, 100% { opacity: 0; }
  10% { opacity: 1; }
  22% { opacity: 0; }
  52% { opacity: 0; }
  62% { opacity: 0.9; }
  74% { opacity: 0; }
`;

const animacion = (nombre, segundos, desfase, extra = 'ease-in-out infinite') => ({
  animation: `${nombre} ${segundos}s ${extra}`,
  // Negativo: cada medalla arranca a mitad de su ciclo, no todas a la vez.
  animationDelay: `-${(desfase * segundos).toFixed(2)}s`,
});

const sinMovimientoSiLoPide = { '@media (prefers-reduced-motion: reduce)': { animation: 'none' } };

/** Una medalla, con un hueco gris mientras llega la imagen, y sus efectos. */
export function ImagenDeMedalla({
  medalla,
  pequena = false,
  efectoMovimiento = EFECTOS_MOVIMIENTO_MEDALLA.SOPLO,
  efectoBrillo = EFECTOS_BRILLO_MEDALLA.DESTELLO,
  sx,
}) {
  const [cargada, setCargada] = useState(false);
  const src = pequena ? medalla.srcPequena || medalla.src : medalla.src;
  const desfase = desfaseDeMedalla(medalla.id);
  const movimiento = normalizarMovimientoMedalla(efectoMovimiento);
  const brillo = normalizarBrilloMedalla(efectoBrillo);

  const animacionDeLaPieza =
    movimiento === EFECTOS_MOVIMIENTO_MEDALLA.SOPLO
      ? animacion(rafagaPieza, 7, desfase)
      : movimiento === EFECTOS_MOVIMIENTO_MEDALLA.BALANCEO
        ? animacion(balanceo, 4.5, desfase)
        : {};
  const animacionDelMedallon =
    movimiento === EFECTOS_MOVIMIENTO_MEDALLA.SOPLO
      ? animacion(rafagaMedallon, 7, desfase)
      : movimiento === EFECTOS_MOVIMIENTO_MEDALLA.PENDULO
        ? animacion(pendulo, 6, desfase)
        : movimiento === EFECTOS_MOVIMIENTO_MEDALLA.LATIDO
          ? animacion(latido, 3.2, desfase)
          : {};

  // La máscara es la propia medalla: el brillo solo cae donde hay metal o hilo.
  const mascara = {
    maskImage: `url("${src}")`,
    WebkitMaskImage: `url("${src}")`,
    maskSize: '100% 100%',
    WebkitMaskSize: '100% 100%',
  };

  return (
    <Box
      sx={[
        {
          position: 'relative',
          width: 1,
          transformOrigin: '50% 0',
          ...(cargada ? animacionDeLaPieza : {}),
          ...sinMovimientoSiLoPide,
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {!cargada && (
        <Skeleton
          variant="rounded"
          sx={{ position: 'absolute', inset: 0, height: 1, width: 1, borderRadius: 1 }}
        />
      )}

      {/* La cinta (y la que da el tamaño a todo). */}
      <Box
        component="img"
        src={src}
        alt={medalla.nombre}
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
          // Las medallas son altas (~1:2); el hueco reserva ese alto antes de cargar.
          aspectRatio: cargada ? 'auto' : '1 / 2',
          objectFit: 'contain',
          opacity: cargada ? 1 : 0,
          transition: 'opacity 0.2s',
          clipPath: cargada ? `inset(0 0 ${100 - CORTE - 1}% 0)` : 'none',
        }}
      />

      {/* El medallón: la misma imagen, recortada desde el corte, que se mece
          colgado de su argolla. El recorte sobra por los lados y por abajo para
          que el resplandor no se corte. */}
      {cargada && (
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            inset: 0,
            clipPath: `inset(${CORTE}% -30% -30% -30%)`,
            transformOrigin:
              movimiento === EFECTOS_MOVIMIENTO_MEDALLA.LATIDO ? '50% 78%' : `50% ${CORTE}%`,
            ...animacionDelMedallon,
            ...sinMovimientoSiLoPide,
          }}
        >
          <Box
            component="img"
            src={src}
            alt=""
            draggable={false}
            sx={{
              width: 1,
              height: 1,
              display: 'block',
              objectFit: 'contain',
              ...(brillo === EFECTOS_BRILLO_MEDALLA.RESPLANDOR
                ? animacion(resplandor, 3.4, desfase)
                : {}),
              ...sinMovimientoSiLoPide,
            }}
          />

          {brillo === EFECTOS_BRILLO_MEDALLA.DESTELLO && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                ...mascara,
                backgroundImage:
                  'linear-gradient(110deg, transparent 35%, rgba(255, 246, 214, 0.85) 50%, transparent 65%)',
                backgroundSize: '250% 100%',
                mixBlendMode: 'screen',
                ...animacion(destello, 4.6, desfase, 'ease-in-out infinite'),
                ...sinMovimientoSiLoPide,
              }}
            />
          )}

          {brillo === EFECTOS_BRILLO_MEDALLA.CENTELLEO && (
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                ...mascara,
                backgroundImage: [
                  'radial-gradient(circle at 38% 72%, rgba(255, 255, 255, 0.95) 0 1.2%, transparent 3.5%)',
                  'radial-gradient(circle at 63% 84%, rgba(255, 244, 200, 0.95) 0 1%, transparent 3%)',
                  'radial-gradient(circle at 52% 64%, rgba(255, 255, 255, 0.9) 0 0.8%, transparent 2.5%)',
                ].join(', '),
                mixBlendMode: 'screen',
                ...animacion(centelleo, 3.8, desfase),
                ...sinMovimientoSiLoPide,
              }}
            />
          )}
        </Box>
      )}
    </Box>
  );
}

// `maxWidth` y los espacios, los MISMOS que `CintasDeMiembro`: cada medalla mide
// lo que una cinta y queda debajo de la última fila con el mismo hueco.
export function MedallasDeMiembro({
  idMiembros,
  sx,
  maxWidth = 300,
  espacioHorizontal = 0.3,
  espacioVertical = 0.3,
}) {
  const catalogo = useCatalogoDeMedallas();
  const orden = useOrdenDeMedallas();
  const { cargando, medallas } = useMedallasDelMiembro(idMiembros);

  const porId = useMemo(
    () => new Map(catalogo.map((medalla) => [medalla.id, medalla])),
    [catalogo]
  );
  const filas = useMemo(
    () => disponerMedallasEnFilas(cargando ? [] : ordenarMedallas(medallas, catalogo, orden)),
    [cargando, medallas, catalogo, orden]
  );
  const configuraciones = useMemo(() => configuracionDeMedallas(medallas), [medallas]);

  if (!filas.length) return null;

  return (
    <Box
      sx={[
        {
          mx: 'auto',
          mt: espacioVertical,
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
          sx={{ display: 'flex', justifyContent: 'center', columnGap: espacioHorizontal }}
        >
          {fila.map((idMedalla) => {
            const medalla = porId.get(idMedalla);

            return (
              <Tooltip key={idMedalla} arrow title={medalla.nombre}>
                <Box
                  sx={(theme) => ({
                    width: `calc((100% - ${theme.spacing(espacioHorizontal * (MEDALLAS_POR_FILA - 1))}) / ${MEDALLAS_POR_FILA})`,
                  })}
                >
                  <ImagenDeMedalla medalla={medalla} pequena {...configuraciones.get(idMedalla)} />
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
 * La pestaña "Medallas" del diálogo de las cintas: el catálogo en el orden
 * global, para marcar y desmarcar. El estado lo lleva el diálogo, que guarda
 * cintas y medallas con el mismo botón.
 */
export function SelectorDeMedallas({
  catalogo = [],
  elegidas,
  onCambiar,
  efectoMovimiento = EFECTOS_MOVIMIENTO_MEDALLA.SOPLO,
  efectoBrillo = EFECTOS_BRILLO_MEDALLA.DESTELLO,
  onCambiarEfectos,
}) {
  const [busqueda, setBusqueda] = useState('');

  const visibles = useMemo(() => {
    const termino = normalizarBusqueda(busqueda);

    return termino
      ? catalogo.filter((medalla) => normalizarBusqueda(medalla.nombre).includes(termino))
      : catalogo;
  }, [busqueda, catalogo]);

  const alternar = (idMedalla) => {
    const siguientes = new Set(elegidas);

    if (siguientes.has(idMedalla)) siguientes.delete(idMedalla);
    // Como mucho tres: en el perfil no se ve ninguna más.
    else if (siguientes.size >= MAXIMO_MEDALLAS) {
      toast.info(`Como máximo ${MAXIMO_MEDALLAS} medallas. Quita una para poner otra.`);
      return;
    } else siguientes.add(idMedalla);

    onCambiar(siguientes);
  };

  return (
    <>
      <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
        Elegidas: {elegidas.size} de {MAXIMO_MEDALLAS}. En el perfil van debajo de las cintas, en el
        orden global de EXPLORA Designer.
      </Typography>

      <TextField
        fullWidth
        size="small"
        label="Buscar medalla"
        value={busqueda}
        onChange={(evento) => setBusqueda(evento.target.value)}
        slotProps={{
          input: { startAdornment: <Iconify icon="eva:search-fill" sx={{ mr: 1 }} /> },
        }}
        sx={{ mb: 2, maxWidth: 532 }}
      />

      {/* Globales para el miembro, como el brillo de las cintas: valen para todas
          sus medallas y se combinan entre sí. */}
      <Box
        sx={{
          mb: 2,
          gap: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 260px))' },
        }}
      >
        <TextField
          select
          fullWidth
          size="small"
          label="Movimiento global"
          value={normalizarMovimientoMedalla(efectoMovimiento)}
          onChange={(evento) =>
            onCambiarEfectos?.({ efectoMovimiento: evento.target.value, efectoBrillo })
          }
        >
          {OPCIONES_MOVIMIENTO_MEDALLA.map(([valor, etiqueta]) => (
            <MenuItem key={valor} value={valor}>
              {etiqueta}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          fullWidth
          size="small"
          label="Brillo global del medallón"
          value={normalizarBrilloMedalla(efectoBrillo)}
          onChange={(evento) =>
            onCambiarEfectos?.({ efectoMovimiento, efectoBrillo: evento.target.value })
          }
        >
          {OPCIONES_BRILLO_MEDALLA.map(([valor, etiqueta]) => (
            <MenuItem key={valor} value={valor}>
              {etiqueta}
            </MenuItem>
          ))}
        </TextField>
      </Box>

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
        {visibles.map((medalla) => {
          const activa = elegidas.has(medalla.id);

          return (
            <Box
              key={medalla.id}
              role="checkbox"
              aria-checked={activa}
              tabIndex={0}
              onClick={() => alternar(medalla.id)}
              onKeyDown={(evento) => {
                if (evento.key === ' ' || evento.key === 'Enter') {
                  evento.preventDefault();
                  alternar(medalla.id);
                }
              }}
              title={medalla.nombre}
              sx={(theme) => ({
                p: 0.75,
                minWidth: 0,
                cursor: 'pointer',
                borderRadius: 1,
                backgroundColor: activa
                  ? theme.vars.palette.primary.lighter
                  : theme.vars.palette.background.paper,
                border: `2px solid ${
                  activa ? theme.vars.palette.primary.main : theme.vars.palette.divider
                }`,
                ...theme.applyStyles('dark', {
                  backgroundColor: activa
                    ? theme.vars.palette.primary.darker
                    : theme.vars.palette.background.paper,
                }),
              })}
            >
              <ImagenDeMedalla
                medalla={medalla}
                pequena
                efectoMovimiento={efectoMovimiento}
                efectoBrillo={efectoBrillo}
              />
              <Typography
                variant="caption"
                sx={{ mt: 0.5, display: 'block', lineHeight: 1.25, overflowWrap: 'anywhere' }}
              >
                {medalla.nombre}
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
              ? 'No encontramos medallas con esa búsqueda.'
              : 'Todavía no hay imágenes en la carpeta de medallas.'}
          </Typography>
        )}
      </Box>
    </>
  );
}
