'use client';

import useSWR from 'swr';
import { onSnapshot } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { keyframes } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

import {
  recordarImagenDelPerfil,
  imagenDelPerfilYaResuelta,
  recordarInsigniasDelPerfil,
  leerInsigniasDelPerfilEnCache,
} from 'src/utils/cache-visual-perfil-miembro.mjs';
import {
  AJUSTES_MEDALLA,
  MAXIMO_MEDALLAS,
  ordenarMedallas,
  desfaseDeMedalla,
  MEDALLAS_POR_FILA,
  EFECTOS_BRILLO_MEDALLA,
  normalizarAjusteMedalla,
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
import { useInsigniasPersonalizadas } from './use-insignias-personalizadas';

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

function useLecturaDelCatalogo() {
  const { data, error } = useSWR(
    typeof window !== 'undefined'
      ? ['/api/insignias/medallas/', { baseURL: window.location.origin }]
      : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60_000, keepPreviousData: true }
  );

  // Las añadidas en EXPLORA Designer (Firestore) van detrás de las de la carpeta.
  const { medallas: personalizadas } = useInsigniasPersonalizadas();
  const deCarpeta = data?.medallas ?? VACIO;
  const medallas = useMemo(
    () => (personalizadas.length ? [...deCarpeta, ...personalizadas] : deCarpeta),
    [deCarpeta, personalizadas]
  );

  return { medallas, cargando: !data && !error };
}

/** El catálogo de medallas, una vez por sesión y compartido entre tarjetas. */
export function useCatalogoDeMedallas() {
  return useLecturaDelCatalogo().medallas;
}

// Igual que las cintas: las medallas tardan (Firestore, el catálogo y luego cada
// imagen) y el perfil pegaba un salto al aparecer debajo de las cintas. Se
// recuerda cuántas tenía la última vez para guardar ese hueco con un esqueleto;
// quien no tenía medallas no ve ninguno.
const claveDeCantidad = (id) => `erd-medallas-cantidad-${id}`;

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

/**
 * El hueco de las medallas mientras cargan, con la forma que tendrán (alto ~1:2,
 * filas de 3). Solo si esa persona tenía medallas la última vez. Lo usa también el
 * esqueleto de la página de la cuenta, para que el hueco no cambie a media carga.
 */
export function EsqueletoDeMedallas({
  idMiembros,
  sx,
  maxWidth = 300,
  espacioHorizontal = 0.3,
  espacioVertical = 0.3,
}) {
  const id = String(Number(idMiembros) || '');
  const [esperadas] = useState(() =>
    id && typeof window !== 'undefined' ? Math.min(cantidadRecordada(id), MAXIMO_MEDALLAS) : 0
  );

  if (!esperadas) return null;

  const filas = Array.from({ length: Math.ceil(esperadas / MEDALLAS_POR_FILA) }, (_, fila) =>
    Math.min(MEDALLAS_POR_FILA, esperadas - fila * MEDALLAS_POR_FILA)
  );

  return (
    <Box
      aria-busy="true"
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
      {filas.map((cuantas, fila) => (
        <Box
          key={fila}
          sx={{ display: 'flex', justifyContent: 'center', columnGap: espacioHorizontal }}
        >
          {Array.from({ length: cuantas }, (_, indice) => (
            <Skeleton
              key={indice}
              variant="rounded"
              sx={(theme) => ({
                height: 'auto',
                // La misma proporción que reserva `ImagenDeMedalla` antes de cargar.
                aspectRatio: '1 / 2',
                width: `calc((100% - ${theme.spacing(espacioHorizontal * (MEDALLAS_POR_FILA - 1))}) / ${MEDALLAS_POR_FILA})`,
              })}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

/**
 * Las medallas guardadas de un miembro, en vivo. `cargando` hasta la primera
 * lectura; sin permiso o sin red, ninguna.
 */
export function useMedallasDelMiembro(idMiembros) {
  const id = String(Number(idMiembros) || '');
  const [leidas, setLeidas] = useState(() => {
    const medallasEnCache = leerInsigniasDelPerfilEnCache('medallas', id);

    return medallasEnCache === undefined
      ? { idLeido: '', medallas: [] }
      : { idLeido: id, medallas: medallasEnCache };
  });

  useEffect(() => {
    if (!id) return undefined;

    return onSnapshot(
      referenciaDeMedallas(id),
      (instantanea) => {
        const medallas = instantanea.data()?.medallas ?? [];

        recordarInsigniasDelPerfil('medallas', id, medallas);
        setLeidas({ idLeido: id, medallas });
      },
      (error) => {
        // Sin permiso o sin red el perfil sigue pintándose, solo que sin medallas.
        console.error('[medallas] no se pudieron leer', error);
        setLeidas({ idLeido: id, medallas: [] });
      }
    );
  }, [id]);

  const medallasEnCache = leerInsigniasDelPerfilEnCache('medallas', id);

  return {
    cargando: leidas.idLeido !== id && medallasEnCache === undefined,
    medallas: leidas.idLeido === id ? leidas.medallas : (medallasEnCache ?? []),
  };
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
// NINGÚN efecto tiene tramos quietos dentro del ciclo: con pausas, la medalla
// parecía congelarse y volver a arrancar. Son suaves y continuos.
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

// Aire que no para: la pieza se mece sin quedarse quieta, con vaivenes
// desiguales para que no parezca un metrónomo.
const rafagaPieza = keyframes`
  0%, 100% { transform: rotate(calc(0deg * var(--fuerza, 1))); }
  20% { transform: rotate(calc(-1.8deg * var(--fuerza, 1))); }
  40% { transform: rotate(calc(1.2deg * var(--fuerza, 1))); }
  60% { transform: rotate(calc(-0.8deg * var(--fuerza, 1))); }
  80% { transform: rotate(calc(1.5deg * var(--fuerza, 1))); }
`;

// El medallón va detrás y se mece más: cuelga de la cinta.
const rafagaMedallon = keyframes`
  0%, 100% { transform: rotate(calc(0.6deg * var(--fuerza, 1))); }
  24% { transform: rotate(calc(-3.2deg * var(--fuerza, 1))); }
  44% { transform: rotate(calc(2.4deg * var(--fuerza, 1))); }
  64% { transform: rotate(calc(-1.6deg * var(--fuerza, 1))); }
  84% { transform: rotate(calc(2.8deg * var(--fuerza, 1))); }
`;

const pendulo = keyframes`
  0%, 100% { transform: rotate(calc(-3.5deg * var(--fuerza, 1))); }
  50% { transform: rotate(calc(3.5deg * var(--fuerza, 1))); }
`;

const balanceo = keyframes`
  0%, 100% { transform: rotate(calc(-1.8deg * var(--fuerza, 1))); }
  50% { transform: rotate(calc(1.8deg * var(--fuerza, 1))); }
`;

// Respira sin pausas: con un tramo quieto parecía congelarse.
const latido = keyframes`
  0%, 100% { transform: scale(1); }
  50% { transform: scale(calc(1 + 0.04 * var(--fuerza, 1))); }
`;

// El destello cruza sin descanso: dos franjas por tramo de 2 anchos, así
// siempre hay una a la vista y el bucle no se nota (antes esperaba medio ciclo
// fuera de la medalla y parecía que se congelaba).
const destello = keyframes`
  from { background-position: 0% 0; }
  to { background-position: -200% 0; }
`;

const resplandor = keyframes`
  0%, 100% { filter: drop-shadow(0 0 0 rgba(255, 214, 102, 0)) brightness(1); }
  50% {
    filter: drop-shadow(0 0 calc(5px * var(--intensidad, 1)) rgba(255, 214, 102, 0.85))
      brightness(calc(1 + 0.12 * var(--intensidad, 1)));
  }
`;

// Sin tramos quietos: con pausas en 0 el centelleo parecía congelarse y volver
// a arrancar. Ahora sube y baja todo el ciclo, sin llegar a apagarse del todo.
const centelleo = keyframes`
  0%, 100% { opacity: calc(0.25 * var(--intensidad, 1)); }
  25% { opacity: calc(1 * var(--intensidad, 1)); }
  50% { opacity: calc(0.4 * var(--intensidad, 1)); }
  75% { opacity: calc(0.9 * var(--intensidad, 1)); }
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
  velocidadMovimiento = 1,
  amplitudMovimiento = 1,
  velocidadBrillo = 1,
  intensidadBrillo = 1,
  sx,
}) {
  const src = pequena ? medalla.srcPequena || medalla.src : medalla.src;
  const [cargada, setCargada] = useState(() => imagenDelPerfilYaResuelta(src));
  const marcarCargada = () => {
    recordarImagenDelPerfil(src);
    setCargada(true);
  };
  const desfase = desfaseDeMedalla(medalla.id);
  const movimiento = normalizarMovimientoMedalla(efectoMovimiento);
  const brillo = normalizarBrilloMedalla(efectoBrillo);
  // Más velocidad = ciclo más corto. La fuerza y la intensidad viajan como
  // variables CSS que multiplican los grados, la escala y la luz de cada efecto.
  const rapidezMovimiento = normalizarAjusteMedalla('velocidadMovimiento', velocidadMovimiento);
  const rapidezBrillo = normalizarAjusteMedalla('velocidadBrillo', velocidadBrillo);
  const intensidad = normalizarAjusteMedalla('intensidadBrillo', intensidadBrillo);
  const mov = (segundos) => segundos / rapidezMovimiento;
  const luz = (segundos) => segundos / rapidezBrillo;
  const variables = {
    '--fuerza': normalizarAjusteMedalla('amplitudMovimiento', amplitudMovimiento),
    '--intensidad': intensidad,
  };

  const animacionDeLaPieza =
    movimiento === EFECTOS_MOVIMIENTO_MEDALLA.SOPLO
      ? animacion(rafagaPieza, mov(6), desfase)
      : movimiento === EFECTOS_MOVIMIENTO_MEDALLA.BALANCEO
        ? animacion(balanceo, mov(4.5), desfase)
        : {};
  const animacionDelMedallon =
    movimiento === EFECTOS_MOVIMIENTO_MEDALLA.SOPLO
      ? animacion(rafagaMedallon, mov(6), desfase)
      : movimiento === EFECTOS_MOVIMIENTO_MEDALLA.PENDULO
        ? animacion(pendulo, mov(3.6), desfase)
        : movimiento === EFECTOS_MOVIMIENTO_MEDALLA.LATIDO
          ? animacion(latido, mov(2.6), desfase)
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
          ...variables,
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
          if (nodo?.complete && nodo.naturalWidth && !cargada) marcarCargada();
        }}
        onLoad={marcarCargada}
        onError={marcarCargada}
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
                ? animacion(resplandor, luz(3.4), desfase)
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
                  'linear-gradient(110deg, transparent 15%, rgba(255, 246, 214, 0.85) 25%, transparent 35%, transparent 65%, rgba(255, 246, 214, 0.85) 75%, transparent 85%)',
                backgroundSize: '200% 100%',
                backgroundRepeat: 'repeat-x',
                mixBlendMode: 'screen',
                // Hasta 1, más o menos visible; por encima, además más luminoso.
                opacity: Math.min(1, intensidad),
                filter: intensidad > 1 ? `brightness(${intensidad})` : 'none',
                ...animacion(destello, luz(5), desfase, 'linear infinite'),
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
                ...animacion(centelleo, luz(2.4), desfase, 'ease-in-out infinite alternate'),
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
  const { medallas: catalogo, cargando: cargandoCatalogo } = useLecturaDelCatalogo();
  const orden = useOrdenDeMedallas();
  const { cargando: cargandoMedallas, medallas } = useMedallasDelMiembro(idMiembros);
  // Sin el catálogo todavía no se sabe qué imagen es cada medalla: también es cargar.
  const cargando = cargandoMedallas || cargandoCatalogo;
  const id = String(Number(idMiembros) || '');

  const porId = useMemo(
    () => new Map(catalogo.map((medalla) => [medalla.id, medalla])),
    [catalogo]
  );
  const filas = useMemo(
    () => disponerMedallasEnFilas(cargando ? [] : ordenarMedallas(medallas, catalogo, orden)),
    [cargando, medallas, catalogo, orden]
  );
  const configuraciones = useMemo(() => configuracionDeMedallas(medallas), [medallas]);
  const visibles = filas.reduce((total, fila) => total + fila.length, 0);

  useEffect(() => {
    if (id && !cargando) recordarCantidad(id, visibles);
  }, [id, cargando, visibles]);

  if (cargando) {
    return (
      <EsqueletoDeMedallas
        idMiembros={id}
        sx={sx}
        maxWidth={maxWidth}
        espacioHorizontal={espacioHorizontal}
        espacioVertical={espacioVertical}
      />
    );
  }

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
/**
 * Las cuatro perillas de los efectos (velocidad y fuerza del movimiento,
 * velocidad e intensidad del brillo). Sirve igual en el diálogo del miembro y en
 * EXPLORA Designer. `valores` trae las cuatro claves de `AJUSTES_MEDALLA`.
 */
export function AjustesDeEfectosDeMedalla({ valores = {}, onCambiar, sx }) {
  return (
    <Box
      sx={[
        {
          columnGap: 3,
          rowGap: 0.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, 1fr)' },
        },
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {Object.entries(AJUSTES_MEDALLA).map(([clave, ajuste]) => {
        const valor = normalizarAjusteMedalla(clave, valores[clave]);

        return (
          <Box key={clave} sx={{ minWidth: 0 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {ajuste.etiqueta}: <strong>{valor.toFixed(2).replace(/\.?0+$/, '')}×</strong>
            </Typography>
            <Slider
              size="small"
              value={valor}
              min={ajuste.min}
              max={ajuste.max}
              step={0.05}
              marks={[{ value: 1 }]}
              valueLabelDisplay="auto"
              valueLabelFormat={(numero) => `${numero}×`}
              onChange={(evento, nuevo) => onCambiar?.({ ...valores, [clave]: nuevo })}
              aria-label={ajuste.etiqueta}
            />
          </Box>
        );
      })}
    </Box>
  );
}

export function SelectorDeMedallas({
  catalogo = [],
  elegidas,
  onCambiar,
  efectos = {},
  onCambiarEfectos,
}) {
  const { efectoMovimiento, efectoBrillo } = efectos;

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

      {/* Globales para el miembro, como el brillo de las cintas: valen para todas
          sus medallas y se combinan entre sí. */}
      <Box
        sx={{
          mb: 2,
          gap: 1.5,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 300px) repeat(2, minmax(0, 220px))' },
        }}
      >
        <TextField
          fullWidth
          size="small"
          label="Buscar medalla"
          value={busqueda}
          onChange={(evento) => setBusqueda(evento.target.value)}
          slotProps={{
            input: { startAdornment: <Iconify icon="eva:search-fill" sx={{ mr: 1 }} /> },
          }}
        />
        <TextField
          select
          fullWidth
          size="small"
          label="Movimiento global"
          value={normalizarMovimientoMedalla(efectoMovimiento)}
          onChange={(evento) =>
            onCambiarEfectos?.({ ...efectos, efectoMovimiento: evento.target.value })
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
            onCambiarEfectos?.({ ...efectos, efectoBrillo: evento.target.value })
          }
        >
          {OPCIONES_BRILLO_MEDALLA.map(([valor, etiqueta]) => (
            <MenuItem key={valor} value={valor}>
              {etiqueta}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <AjustesDeEfectosDeMedalla valores={efectos} onCambiar={onCambiarEfectos} sx={{ mb: 2 }} />

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
              <ImagenDeMedalla medalla={medalla} pequena {...efectos} />
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
