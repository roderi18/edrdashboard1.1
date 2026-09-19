'use client';

import { onSnapshot } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';

import Box from '@mui/material/Box';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Dialog from '@mui/material/Dialog';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Tooltip from '@mui/material/Tooltip';
import Skeleton from '@mui/material/Skeleton';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import { keyframes } from '@mui/material/styles';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';

import { isAdminGlobal } from 'src/utils/org-level-access';
import { catalogoDePinesEnOrden } from 'src/utils/pines-perfil.mjs';
import { configuracionDeMedallas, catalogoDeMedallasEnOrden } from 'src/utils/medallas-perfil.mjs';
import {
  AJUSTES_CINTA,
  digitosDeVeces,
  CINTAS_POR_FILA,
  normalizarVeces,
  catalogoEnOrden,
  obtenerCintaPerfil,
  MAXIMO_VECES_CINTA,
  EFECTOS_BORDE_CINTA,
  EFECTOS_NUMERO_CINTA,
  disponerCintasEnFilas,
  configuracionPorCinta,
  normalizarEfectoBorde,
  normalizarAjusteCinta,
  MAXIMO_CINTAS_VISIBLES,
  normalizarEfectoNumero,
} from 'src/utils/cintas-perfil.mjs';

import { referenciaDeCintas } from 'src/services/cintas-miembros-apply';
import { guardarPinesDeMiembro } from 'src/services/pines-miembros-service';
import { guardarCintasDeMiembro } from 'src/services/cintas-miembros-service';
import { guardarMedallasDeMiembro } from 'src/services/medallas-miembros-service';

import { Label } from 'src/components/label';
import { toast } from 'src/components/snackbar';
import { Iconify } from 'src/components/iconify';

import { useAuthContext } from 'src/auth/hooks';

import { useInsigniasPersonalizadas } from './use-insignias-personalizadas';
import { SelectorDePines, useCatalogoDePines, usePinesDelMiembro } from './pines-de-miembro';
import { useOrdenDePines, useOrdenDeCintas, useOrdenDeMedallas } from './use-orden-de-cintas';
import {
  SelectorDeMedallas,
  useCatalogoDeMedallas,
  useMedallasDelMiembro,
} from './medallas-de-miembro';

// ----------------------------------------------------------------------

const destelloDorado = keyframes`
  0%, 55%, 100% { background-position: 160% 0; }
  78% { background-position: -60% 0; }
`;

const destelloDelBorde = keyframes`
  0%, 58%, 100% { background-position: 165% 0; }
  80% { background-position: -65% 0; }
`;

const olaDelBorde = keyframes`
  0% { background-position: -80% 50%; }
  100% { background-position: 180% 50%; }
`;

const pulsoDelBorde = keyframes`
  0%, 100% { opacity: 0.18; }
  50% { opacity: 0.72; }
`;

const centelleoDelBorde = keyframes`
  0%, 100% { background-position: -35% 50%, 135% 50%; opacity: 0.15; }
  35% { opacity: 0.75; }
  65% { background-position: 135% 50%, -35% 50%; opacity: 0.4; }
`;

const estrellaDorada = keyframes`
  0% { opacity: 0; transform: scale(0.25) rotate(0deg); }
  35% { opacity: 0.85; transform: scale(1) rotate(35deg); }
  100% { opacity: 0; transform: scale(0.15) rotate(90deg); }
`;

const auraDorada = keyframes`
  0%, 100% { filter: drop-shadow(0 0 1px rgba(255, 230, 130, 0.3)); }
  50% { filter: drop-shadow(0 0 calc(4px * var(--intensidad-numero, 1)) rgba(255, 210, 70, 0.72)); }
`;

const centelleoDelNumero = keyframes`
  0%, 35%, 100% { opacity: 0; transform: scale(0.25) rotate(0deg); }
  45% { opacity: 0.82; transform: scale(0.9) rotate(40deg); }
  55% { opacity: 0; transform: scale(0.2) rotate(75deg); }
`;

const CINTAS_CON_BORDE_DORADO = new Set(['3', '5', '6', '7', '12a']);

const normalizarBusqueda = (valor) =>
  String(valor ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

export const OPCIONES_BORDE = [
  [EFECTOS_BORDE_CINTA.BARRIDO, 'Barrido actual'],
  [EFECTOS_BORDE_CINTA.OLA, 'Ola lenta'],
  [EFECTOS_BORDE_CINTA.PULSO, 'Pulso suave'],
  [EFECTOS_BORDE_CINTA.CENTELLEO, 'Centelleo doble'],
  [EFECTOS_BORDE_CINTA.NINGUNO, 'Sin efecto'],
];

export const OPCIONES_NUMERO = [
  [EFECTOS_NUMERO_CINTA.BARRIDO, 'Barrido actual'],
  [EFECTOS_NUMERO_CINTA.DESTELLO, 'Destello de estrella'],
  [EFECTOS_NUMERO_CINTA.AURA, 'Aura dorada'],
  [EFECTOS_NUMERO_CINTA.CENTELLEO, 'Centelleo doble'],
  [EFECTOS_NUMERO_CINTA.NINGUNO, 'Sin efecto'],
];

const mascaraDelBorde = {
  WebkitMaskImage:
    'linear-gradient(#000 0 0), linear-gradient(#000 0 0), linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
  maskImage:
    'linear-gradient(#000 0 0), linear-gradient(#000 0 0), linear-gradient(#000 0 0), linear-gradient(#000 0 0)',
  WebkitMaskSize: '100% 16%, 100% 16%, 6% 68%, 6% 68%',
  maskSize: '100% 16%, 100% 16%, 6% 68%, 6% 68%',
  WebkitMaskPosition: 'top, bottom, left center, right center',
  maskPosition: 'top, bottom, left center, right center',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
};

// Más velocidad = ciclo más corto; con 1, los segundos de siempre.
const duracion = (segundos, velocidad) => `${(segundos / velocidad).toFixed(2)}s`;

// La intensidad va en una capa aparte y no en el propio brillo: el pulso y el
// centelleo ya animan su opacidad y la de la capa se multiplica con ella. Hasta 1
// se ve menos; por encima, además más luminoso.
const capaDeIntensidad = (intensidad) => ({
  inset: 0,
  position: 'absolute',
  pointerEvents: 'none',
  opacity: Math.min(1, intensidad),
  ...(intensidad > 1 && { filter: `brightness(${intensidad})` }),
});

const estiloDelBorde = (efecto, velocidad = 1) => {
  switch (normalizarEfectoBorde(efecto)) {
    case EFECTOS_BORDE_CINTA.OLA:
      return {
        backgroundImage:
          'radial-gradient(ellipse at center, rgba(255, 250, 214, 0.72) 0%, rgba(255, 205, 72, 0.34) 38%, transparent 70%)',
        backgroundSize: '52% 220%',
        backgroundRepeat: 'no-repeat',
        animation: `${olaDelBorde} ${duracion(9, velocidad)} linear infinite`,
      };
    case EFECTOS_BORDE_CINTA.PULSO:
      return {
        backgroundColor: 'rgba(255, 215, 92, 0.5)',
        animation: `${pulsoDelBorde} ${duracion(3.8, velocidad)} ease-in-out infinite`,
      };
    case EFECTOS_BORDE_CINTA.CENTELLEO:
      return {
        backgroundImage:
          'radial-gradient(circle, rgba(255, 252, 221, 0.85) 0%, transparent 62%), radial-gradient(circle, rgba(255, 211, 80, 0.65) 0%, transparent 62%)',
        backgroundSize: '22% 150%, 18% 130%',
        backgroundRepeat: 'no-repeat',
        animation: `${centelleoDelBorde} ${duracion(6.5, velocidad)} ease-in-out infinite`,
      };
    case EFECTOS_BORDE_CINTA.NINGUNO:
      return { display: 'none' };
    default:
      return {
        backgroundImage:
          'linear-gradient(110deg, transparent 42%, rgba(255, 249, 202, 0.7) 50%, transparent 58%)',
        backgroundSize: '270% 100%',
        backgroundPosition: '165% 0',
        animation: `${destelloDelBorde} ${duracion(4.8, velocidad)} ease-in-out infinite`,
      };
  }
};

// ----------------------------------------------------------------------

// LAS CINTAS TARDAN EN LLEGAR (Firestore y luego cada imagen), y el perfil
// pegaba un salto al aparecer. Se recuerda cuántas tenía la última vez para
// guardar ese hueco con un esqueleto; quien no tenía cintas no ve ninguno.
const claveDeCantidad = (id) => `erd-cintas-cantidad-${id}`;

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

// Proporción de las imágenes de cinta (240 × ~71): el esqueleto ocupa lo mismo.
const PROPORCION_CINTA = '240 / 71';

// ----------------------------------------------------------------------

/**
 * El hueco de las cintas mientras cargan, con la misma forma que tendran: filas
 * de 3 y la ultima centrada. Solo si esa persona tenia cintas la ultima vez.
 *
 * Lo usa tambien el esqueleto de la pagina de la cuenta, para que el hueco sea el
 * MISMO antes y despues de que llegue el miembro: con dos esqueletos distintos
 * la tarjeta cambiaba de forma a media carga.
 */
export function EsqueletoDeCintas({
  idMiembros,
  sx,
  maxWidth = 300,
  espacioHorizontal = 0.3,
  espacioVertical = 0.3,
}) {
  const id = String(Number(idMiembros) || '');
  const [esperadas] = useState(() =>
    id && typeof window !== 'undefined'
      ? Math.min(cantidadRecordada(id), MAXIMO_CINTAS_VISIBLES)
      : 0
  );

  if (!esperadas) return null;

  const filas = Array.from({ length: Math.ceil(esperadas / CINTAS_POR_FILA) }, (_, fila) =>
    Math.min(CINTAS_POR_FILA, esperadas - fila * CINTAS_POR_FILA)
  );

  return (
    <Box
      aria-busy="true"
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
                aspectRatio: PROPORCION_CINTA,
                width: `calc((100% - ${theme.spacing(espacioHorizontal * (CINTAS_POR_FILA - 1))}) / ${CINTAS_POR_FILA})`,
              })}
            />
          ))}
        </Box>
      ))}
    </Box>
  );
}

// ----------------------------------------------------------------------

// Igual que el menú lateral: la cuenta administrativa de siempre llega con
// `role: 'admin'` y no con el cargo.
const esAdministradorGlobal = (user) =>
  isAdminGlobal(user) ||
  String(user?.role ?? user?.rol ?? '')
    .trim()
    .toLowerCase() === 'admin';

// Cintas del perfil de un miembro, leídas de `cintas_miembros/{idMiembros}` y
// dispuestas con la regla de `src/utils/cintas-perfil.mjs`. El Administrador
// Global ve un lápiz para ponerlas a mano mientras no estén conectadas a awards.
// `espacioHorizontal` / `espacioVertical`: separación entre cintas (unidades del
// tema: 1 = 8px). En 0 van pegadas, como en el manual.
export function CintasDeMiembro({
  idMiembros,
  sx,
  maxWidth = 300,
  espacioHorizontal = 0.3,
  espacioVertical = 0.3,
}) {
  const { user } = useAuthContext();
  const puedeEditar = esAdministradorGlobal(user);
  const id = String(Number(idMiembros) || '');

  // `idLeido` dice de quién son las cintas: mientras no coincide, siguen cargando.
  const [leidas, setLeidas] = useState({ idLeido: '', cintas: [] });
  const [abierto, setAbierto] = useState(false);
  const cargando = leidas.idLeido !== id;
  const asignadas = useMemo(() => (cargando ? [] : leidas.cintas), [cargando, leidas.cintas]);

  useEffect(() => {
    if (!id) return undefined;

    return onSnapshot(
      referenciaDeCintas(id),
      (instantanea) => {
        const cintas = instantanea.data()?.cintas ?? [];

        recordarCantidad(id, cintas.length);
        setLeidas({ idLeido: id, cintas });
      },
      (error) => {
        // Sin permiso o sin red el perfil sigue pintándose, solo que sin cintas.
        console.error('[cintas] no se pudieron leer', error);
        setLeidas({ idLeido: id, cintas: [] });
      }
    );
  }, [id]);

  // El orden global que se arrastra en EXPLORA Designer manda también aquí, en
  // los perfiles que ya tenían sus cintas puestas.
  const orden = useOrdenDeCintas();
  // Las añadidas en el Designer: al llegar se registran en el catálogo y esto se
  // vuelve a calcular, para que una de ellas no se descarte por "desconocida".
  const { cintas: personalizadas } = useInsigniasPersonalizadas();
  const filas = useMemo(
    () => disponerCintasEnFilas(asignadas, { orden }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asignadas, orden, personalizadas]
  );
  const configuraciones = useMemo(() => configuracionPorCinta(asignadas), [asignadas]);

  if (!id) return null;

  if (cargando) {
    return (
      <EsqueletoDeCintas
        idMiembros={id}
        sx={sx}
        maxWidth={maxWidth}
        espacioHorizontal={espacioHorizontal}
        espacioVertical={espacioVertical}
      />
    );
  }

  if (!filas.length && !puedeEditar) return null;

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
          key={fila.join('-')}
          sx={{ display: 'flex', justifyContent: 'center', columnGap: espacioHorizontal }}
        >
          {fila.map((idCinta) => {
            const cinta = obtenerCintaPerfil(idCinta);
            const configuracion = configuraciones.get(idCinta);
            return (
              <Tooltip
                key={idCinta}
                arrow
                title={<TextoDeCinta cinta={cinta} />}
                // El aviso de MUI se queda en 300px de ancho: la descripción salía como
                // una columna estrecha y larga.
                slotProps={{ tooltip: { sx: { maxWidth: 380 } } }}
              >
                <Box
                  sx={(theme) => ({
                    // El hueco se descuenta del ancho para que 3 sigan cabiendo en la fila.
                    width: `calc((100% - ${theme.spacing(espacioHorizontal * (CINTAS_POR_FILA - 1))}) / ${CINTAS_POR_FILA})`,
                  })}
                >
                  <ImagenDeCinta cinta={cinta} {...configuracion} />
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      ))}

      {puedeEditar && !filas.length && (
        <Typography variant="caption" sx={{ color: 'text.disabled', textAlign: 'center' }}>
          Sin cintas
        </Typography>
      )}

      {/* En la esquina superior derecha de la tarjeta del perfil: la tarjeta que
          lo contiene lleva `position: 'relative'`. */}
      {puedeEditar && (
        <Tooltip title="Asignar cintas de prueba">
          <IconButton
            size="small"
            onClick={() => setAbierto(true)}
            // Debajo del chip de estatus, que ocupa la esquina.
            sx={{ position: 'absolute', top: 48, right: 12, zIndex: 1 }}
          >
            <Iconify icon="solar:pen-bold" width={18} />
          </IconButton>
        </Tooltip>
      )}

      {abierto && (
        <DialogoCintasDePrueba
          idMiembros={id}
          asignadas={asignadas}
          user={user}
          onClose={() => setAbierto(false)}
        />
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

// La cinta con, si se ganó más de una vez, su número dorado en el centro. Las
// cuatro perillas (`AJUSTES_CINTA`) multiplican la velocidad y la intensidad de
// los brillos; sin ellas, todo como siempre.
export function ImagenDeCinta({
  cinta,
  veces,
  efectoBorde,
  efectoNumero,
  velocidadBorde,
  intensidadBorde,
  velocidadNumero,
  intensidadNumero,
}) {
  const digitos = digitosDeVeces(veces);
  const tieneBordeDorado = CINTAS_CON_BORDE_DORADO.has(cinta.id);
  const bordeElegido = normalizarEfectoBorde(efectoBorde);
  const numeroElegido = normalizarEfectoNumero(efectoNumero);
  const rapidezBorde = normalizarAjusteCinta('velocidadBorde', velocidadBorde);
  const fuerzaBorde = normalizarAjusteCinta('intensidadBorde', intensidadBorde);
  const rapidezNumero = normalizarAjusteCinta('velocidadNumero', velocidadNumero);
  const fuerzaNumero = normalizarAjusteCinta('intensidadNumero', intensidadNumero);
  const [brilloAleatorio, setBrilloAleatorio] = useState(null);
  // La imagen aún no llegó: se guarda su hueco con un esqueleto.
  const [imagenLista, setImagenLista] = useState(false);

  useEffect(() => {
    if (numeroElegido !== EFECTOS_NUMERO_CINTA.DESTELLO || !digitos.length) return undefined;

    let temporizadorBrillo;
    let temporizadorSiguiente;

    const programarBrillo = () => {
      temporizadorSiguiente = setTimeout(
        () => {
          setBrilloAleatorio({
            id: Date.now(),
            indice: Math.floor(Math.random() * digitos.length),
          });
          temporizadorBrillo = setTimeout(() => setBrilloAleatorio(null), 850);
          programarBrillo();
        },
        (3500 + Math.random() * 4000) / rapidezNumero
      );
    };

    programarBrillo();

    return () => {
      clearTimeout(temporizadorBrillo);
      clearTimeout(temporizadorSiguiente);
    };
  }, [digitos.length, numeroElegido, rapidezNumero]);

  return (
    <Box
      sx={{
        position: 'relative',
        lineHeight: 0,
        ...(!imagenLista && { aspectRatio: PROPORCION_CINTA }),
      }}
    >
      {!imagenLista && (
        <Skeleton variant="rounded" sx={{ inset: 0, position: 'absolute', height: 1 }} />
      )}
      <Box
        component="img"
        src={cinta.src}
        alt={cinta.nombre}
        onLoad={() => setImagenLista(true)}
        onError={() => setImagenLista(true)}
        // Ya en caché, `onLoad` puede dispararse antes de hidratar: se mira `complete`.
        ref={(imagen) => {
          if (imagen?.complete && !imagenLista) setImagenLista(true);
        }}
        sx={{
          width: 1,
          height: 'auto',
          display: 'block',
          ...(!imagenLista && { opacity: 0, position: 'absolute', inset: 0 }),
        }}
      />
      {tieneBordeDorado && bordeElegido !== EFECTOS_BORDE_CINTA.NINGUNO && (
        <Box aria-hidden="true" sx={{ ...capaDeIntensidad(fuerzaBorde), zIndex: 1 }}>
          <Box
            sx={{
              inset: 0,
              position: 'absolute',
              ...mascaraDelBorde,
              ...estiloDelBorde(bordeElegido, rapidezBorde),
              filter: 'drop-shadow(0 0 2px rgba(255, 193, 7, 0.35))',
              willChange: 'background-position',
              '@media (prefers-reduced-motion: reduce)': {
                display: 'none',
              },
            }}
          />
        </Box>
      )}
      {!!digitos.length && (
        <Box
          aria-label={`Ganada ${normalizarVeces(veces)} veces`}
          sx={{
            inset: 0,
            zIndex: 2,
            display: 'flex',
            position: 'absolute',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'none',
            '--intensidad-numero': fuerzaNumero,
          }}
        >
          {digitos.map((src, indice) => (
            <Box
              key={`${src}-${indice}`}
              sx={{
                height: '62%',
                width: 'auto',
                display: 'inline-flex',
                position: 'relative',
                ...(numeroElegido === EFECTOS_NUMERO_CINTA.BARRIDO && {
                  '&::after': {
                    inset: 0,
                    content: '""',
                    position: 'absolute',
                    backgroundImage:
                      'linear-gradient(110deg, transparent 43%, rgba(255, 248, 190, 0.58) 50%, transparent 57%)',
                    backgroundSize: '260% 100%',
                    backgroundPosition: '160% 0',
                    WebkitMaskImage: `url("${src}")`,
                    maskImage: `url("${src}")`,
                    WebkitMaskSize: 'contain',
                    maskSize: 'contain',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                    WebkitMaskPosition: 'center',
                    maskPosition: 'center',
                    opacity: Math.min(1, fuerzaNumero),
                    ...(fuerzaNumero > 1 && { filter: `brightness(${fuerzaNumero})` }),
                    willChange: 'background-position',
                    animation: `${destelloDorado} ${duracion(3.4, rapidezNumero)} ease-in-out infinite`,
                    '@media (prefers-reduced-motion: reduce)': {
                      display: 'none',
                    },
                  },
                }),
              }}
            >
              <Box
                component="img"
                src={src}
                alt=""
                sx={{
                  width: 'auto',
                  height: '100%',
                  display: 'block',
                  filter:
                    numeroElegido === EFECTOS_NUMERO_CINTA.NINGUNO
                      ? 'drop-shadow(0 2px 1.5px rgba(24, 18, 4, 0.48))'
                      : 'drop-shadow(0 2px 1.5px rgba(24, 18, 4, 0.48)) drop-shadow(0 0 1px rgba(255, 230, 130, 0.55)) drop-shadow(0 0 2px rgba(255, 193, 7, 0.38))',
                  ...(numeroElegido === EFECTOS_NUMERO_CINTA.AURA && {
                    animation: `${auraDorada} ${duracion(3.6, rapidezNumero)} ease-in-out infinite`,
                    '@media (prefers-reduced-motion: reduce)': {
                      animation: 'none',
                    },
                  }),
                }}
              />
              {numeroElegido === EFECTOS_NUMERO_CINTA.DESTELLO &&
                brilloAleatorio?.indice === indice && (
                  <Box component="span" aria-hidden="true" sx={capaDeIntensidad(fuerzaNumero)}>
                    <Box
                      key={brilloAleatorio.id}
                      component="span"
                      aria-hidden="true"
                      sx={{
                        top: '-16%',
                        right: '-24%',
                        zIndex: 1,
                        color: '#fff7bd',
                        fontSize: '0.72rem',
                        lineHeight: 1,
                        position: 'absolute',
                        textShadow:
                          '0 0 2px rgba(255, 255, 235, 0.8), 0 0 4px rgba(255, 193, 7, 0.55)',
                        animation: `${estrellaDorada} 850ms ease-out both`,
                        '@media (prefers-reduced-motion: reduce)': {
                          display: 'none',
                        },
                      }}
                    >
                      ✦
                    </Box>
                  </Box>
                )}
              {numeroElegido === EFECTOS_NUMERO_CINTA.CENTELLEO && (
                <Box component="span" aria-hidden="true" sx={capaDeIntensidad(fuerzaNumero)}>
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      top: '-12%',
                      left: '-20%',
                      color: '#fff7bd',
                      fontSize: '0.55rem',
                      lineHeight: 1,
                      position: 'absolute',
                      animation: `${centelleoDelNumero} ${duracion(4.8, rapidezNumero)} ease-in-out infinite`,
                      '@media (prefers-reduced-motion: reduce)': { display: 'none' },
                    }}
                  >
                    ✦
                  </Box>
                  <Box
                    component="span"
                    aria-hidden="true"
                    sx={{
                      right: '-18%',
                      bottom: '-8%',
                      color: '#ffd95c',
                      fontSize: '0.48rem',
                      lineHeight: 1,
                      position: 'absolute',
                      animation: `${centelleoDelNumero} ${duracion(4.8, rapidezNumero)} ${duracion(1.6, rapidezNumero)} ease-in-out infinite`,
                      '@media (prefers-reduced-motion: reduce)': { display: 'none' },
                    }}
                  >
                    ✦
                  </Box>
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

// Lo que sale al pasar el ratón por una cinta: el nombre en negritas y debajo
// para qué se da.
// La descripción entera tapaba media tarjeta: se ven dos líneas y "Ver más"
// abre el resto dentro del mismo aviso (el Tooltip de MUI deja pulsar dentro).
export function TextoDeCinta({ cinta }) {
  const [completa, setCompleta] = useState(false);

  return (
    <Box sx={{ py: 0.5 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 'fontWeightBold' }}>
        {cinta.nombre}
      </Typography>
      {cinta.descripcion && (
        <>
          <Typography
            variant="body2"
            component="p"
            sx={{
              mt: 0.5,
              ...(!completa && {
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }),
            }}
          >
            {cinta.descripcion}
          </Typography>
          <Button
            size="small"
            color="inherit"
            onClick={() => setCompleta((valor) => !valor)}
            sx={{ mt: 0.5, px: 0.5, minWidth: 0, fontWeight: 'fontWeightBold' }}
          >
            {completa ? 'Ver menos' : 'Ver más'}
          </Button>
        </>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------

/**
 * Las cuatro perillas de los brillos de la cinta (velocidad e intensidad del
 * borde dorado y del número), hermanas de las de las medallas. `valores` trae las
 * claves de `AJUSTES_CINTA`.
 */
export function AjustesDeEfectosDeCinta({ valores = {}, onCambiar, sx }) {
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
      {Object.entries(AJUSTES_CINTA).map(([clave, ajuste]) => {
        const valor = normalizarAjusteCinta(clave, valores[clave]);

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

const PERILLAS_DE_CINTA = Object.keys(AJUSTES_CINTA);

function DialogoCintasDePrueba({ idMiembros, asignadas, user, onClose }) {
  // id → { veces, efectoBorde, efectoNumero }. Estar en el mapa es estar elegida.
  const [elegidas, setElegidas] = useState(() => configuracionPorCinta(asignadas));
  const configuracionInicial = [...configuracionPorCinta(asignadas).values()][0];
  const [efectoBordeGlobal, setEfectoBordeGlobal] = useState(
    configuracionInicial?.efectoBorde ?? EFECTOS_BORDE_CINTA.BARRIDO
  );
  const [efectoNumeroGlobal, setEfectoNumeroGlobal] = useState(
    configuracionInicial?.efectoNumero ?? EFECTOS_NUMERO_CINTA.BARRIDO
  );
  // Globales como los dos brillos: valen para todas sus cintas.
  const [ajustesGlobales, setAjustesGlobales] = useState(() =>
    Object.fromEntries(
      PERILLAS_DE_CINTA.map((clave) => [
        clave,
        normalizarAjusteCinta(clave, configuracionInicial?.[clave]),
      ])
    )
  );
  const [guardando, setGuardando] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  // EL MISMO LÁPIZ PARA CINTAS, MEDALLAS Y PINES: tres pestañas y un solo Guardar.
  const [pestana, setPestana] = useState('cintas');
  const catalogoDeMedallas = useCatalogoDeMedallas();
  const ordenDeMedallas = useOrdenDeMedallas();
  const medallasGuardadas = useMedallasDelMiembro(idMiembros);
  // `null` mientras no se toquen: entonces se guardan las que ya tenía.
  const [medallasElegidas, setMedallasElegidas] = useState(null);
  // Movimiento y brillo, globales para sus medallas. `null`: los que ya tenían.
  const [efectosMedallas, setEfectosMedallas] = useState(null);
  const medallasEnOrden = useMemo(
    () => catalogoDeMedallasEnOrden(catalogoDeMedallas, ordenDeMedallas),
    [catalogoDeMedallas, ordenDeMedallas]
  );
  const medallasActuales = useMemo(
    () =>
      medallasElegidas ??
      new Set(medallasGuardadas.medallas.map((entrada) => String(entrada?.id ?? entrada))),
    [medallasElegidas, medallasGuardadas.medallas]
  );
  // Siempre con las seis claves (tipo de movimiento y brillo, y sus perillas):
  // lo que se toca, encima de lo que tenían sus medallas, encima de lo de fábrica.
  const efectosActuales = useMemo(() => {
    const guardados = [...configuracionDeMedallas(medallasGuardadas.medallas).values()][0];
    const base = configuracionDeMedallas([{ id: 'base', ...guardados }]).get('base');

    return { ...base, ...efectosMedallas };
  }, [efectosMedallas, medallasGuardadas.medallas]);
  // Los pines, en su pestaña. `null` mientras no se toquen: los que ya tenía.
  const catalogoDePines = useCatalogoDePines();
  const ordenDePines = useOrdenDePines();
  const pinesGuardados = usePinesDelMiembro(idMiembros);
  const [pinesElegidos, setPinesElegidos] = useState(null);
  const pinesEnOrden = useMemo(
    () => catalogoDePinesEnOrden(catalogoDePines, ordenDePines),
    [catalogoDePines, ordenDePines]
  );
  const pinesActuales = useMemo(
    () =>
      pinesElegidos ??
      new Set(pinesGuardados.pines.map((entrada) => String(entrada?.id ?? entrada))),
    [pinesElegidos, pinesGuardados.pines]
  );
  // Para elegir, en el mismo orden global en que van a salir en el perfil.
  const orden = useOrdenDeCintas();
  const { cintas: personalizadas } = useInsigniasPersonalizadas();
  const cintasVisibles = useMemo(() => {
    const catalogo = catalogoEnOrden(orden);
    const termino = normalizarBusqueda(busqueda);
    if (!termino) return catalogo;

    return catalogo.filter((cinta) =>
      normalizarBusqueda(`${cinta.id} ${cinta.nombre}`).includes(termino)
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busqueda, orden, personalizadas]);

  const alternar = (idCinta) =>
    setElegidas((previas) => {
      const siguientes = new Map(previas);
      if (siguientes.has(idCinta)) siguientes.delete(idCinta);
      else {
        siguientes.set(idCinta, {
          veces: 1,
          efectoBorde: EFECTOS_BORDE_CINTA.BARRIDO,
          efectoNumero: EFECTOS_NUMERO_CINTA.BARRIDO,
        });
      }
      return siguientes;
    });

  const cambiarVeces = (idCinta, delta) =>
    setElegidas((previas) => {
      const siguientes = new Map(previas);
      const configuracion = siguientes.get(idCinta);
      siguientes.set(idCinta, {
        ...configuracion,
        veces: normalizarVeces((configuracion?.veces ?? 1) + delta),
      });
      return siguientes;
    });

  const guardar = async () => {
    try {
      setGuardando(true);
      await guardarCintasDeMiembro({
        idMiembros,
        anteriores: asignadas,
        elegidas: [...elegidas].map(([id, configuracion]) => ({
          id,
          veces: configuracion.veces,
          efectoBorde: efectoBordeGlobal,
          efectoNumero: efectoNumeroGlobal,
          ...ajustesGlobales,
        })),
        usuario: user,
      });
      const tocoMedallas = Boolean(medallasElegidas || efectosMedallas);
      if (tocoMedallas) {
        await guardarMedallasDeMiembro({
          idMiembros,
          anteriores: medallasGuardadas.medallas,
          // En el orden global: así también queda guardado.
          elegidas: medallasEnOrden
            .map((medalla) => medalla.id)
            .filter((idMedalla) => medallasActuales.has(idMedalla))
            .map((idMedalla) => ({ id: idMedalla, ...efectosActuales })),
          usuario: user,
        });
      }
      if (pinesElegidos) {
        await guardarPinesDeMiembro({
          idMiembros,
          anteriores: pinesGuardados.pines,
          // En el orden global: así también queda guardado.
          elegidos: pinesEnOrden.map((pin) => pin.id).filter((idPin) => pinesActuales.has(idPin)),
          usuario: user,
        });
      }
      toast.success(
        tocoMedallas || pinesElegidos ? 'Cintas, medallas y pines guardados.' : 'Cintas guardadas.'
      );
      onClose();
    } catch (error) {
      console.error('[cintas] no se pudieron guardar', error);
      toast.error('No se pudieron guardar las cintas, las medallas o los pines.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open
      fullWidth
      maxWidth="lg"
      onClose={guardando ? undefined : onClose}
      // Alto fijo: al buscar quedaban pocas insignias y el diálogo se encogía y
      // saltaba. Así mide lo mismo siempre y lo de dentro se desplaza.
      slotProps={{ paper: { sx: { height: 'min(90vh, 880px)' } } }}
    >
      <DialogTitle>
        Cintas, medallas y pines de prueba <Label color="warning">Solo pruebas</Label>
      </DialogTitle>

      <Tabs value={pestana} onChange={(evento, nueva) => setPestana(nueva)} sx={{ px: 3 }}>
        <Tab value="cintas" label={`Cintas (${elegidas.size})`} />
        <Tab
          value="medallas"
          label={`Medallas (${medallasActuales.size})`}
          disabled={medallasGuardadas.cargando}
        />
        <Tab
          value="pines"
          label={`Pines (${pinesActuales.size})`}
          disabled={pinesGuardados.cargando}
        />
      </Tabs>

      <DialogContent sx={{ pt: 3 }}>
        {pestana === 'pines' ? (
          <SelectorDePines
            catalogo={pinesEnOrden}
            elegidos={pinesActuales}
            onCambiar={setPinesElegidos}
          />
        ) : pestana === 'medallas' ? (
          <SelectorDeMedallas
            catalogo={medallasEnOrden}
            elegidas={medallasActuales}
            onCambiar={setMedallasElegidas}
            efectos={efectosActuales}
            onCambiarEfectos={setEfectosMedallas}
          />
        ) : (
          <>
            <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
              Elegidas: {elegidas.size}. En el perfil se ordenan por número y se muestran hasta 18.
              Con más de una vez, la cinta lleva el número en el centro.
            </Typography>

            <Box
              sx={{
                mb: 2,
                gap: 1.5,
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'minmax(0, 300px) repeat(2, minmax(0, 220px))',
                },
              }}
            >
              <TextField
                fullWidth
                size="small"
                label="Buscar cinta"
                placeholder="Número o nombre"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                slotProps={{
                  input: {
                    startAdornment: <Iconify icon="eva:search-fill" sx={{ mr: 1 }} />,
                  },
                }}
              />
              <TextField
                select
                fullWidth
                size="small"
                label="Brillo global de bordes dorados"
                value={efectoBordeGlobal}
                onChange={(evento) => setEfectoBordeGlobal(evento.target.value)}
              >
                {OPCIONES_BORDE.map(([valor, etiqueta]) => (
                  <MenuItem key={valor} value={valor}>
                    {etiqueta}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select
                fullWidth
                size="small"
                label="Brillo global de números"
                value={efectoNumeroGlobal}
                onChange={(evento) => setEfectoNumeroGlobal(evento.target.value)}
              >
                {OPCIONES_NUMERO.map(([valor, etiqueta]) => (
                  <MenuItem key={valor} value={valor}>
                    {etiqueta}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <AjustesDeEfectosDeCinta
              valores={ajustesGlobales}
              onCambiar={setAjustesGlobales}
              sx={{ mb: 2 }}
            />

            <Box
              sx={{
                display: 'grid',
                gap: 1,
                // `minmax(0, 1fr)` y `minWidth: 0`: con `1fr` a secas el nombre sin
                // cortar ensanchaba la columna y la ventana pedía scroll horizontal.
                gridTemplateColumns: {
                  xs: 'repeat(2, minmax(0, 1fr))',
                  sm: 'repeat(4, minmax(0, 1fr))',
                  md: 'repeat(6, minmax(0, 1fr))',
                },
              }}
            >
              {cintasVisibles.map((cinta) => {
                const activa = elegidas.has(cinta.id);
                const configuracion = elegidas.get(cinta.id);
                return (
                  <Box
                    key={cinta.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => alternar(cinta.id)}
                    onKeyDown={(evento) => {
                      if (evento.key === 'Enter' || evento.key === ' ') {
                        evento.preventDefault();
                        alternar(cinta.id);
                      }
                    }}
                    title={cinta.nombre}
                    sx={(theme) => ({
                      p: 0.75,
                      minWidth: 0,
                      borderRadius: 1,
                      cursor: 'pointer',
                      textAlign: 'left',
                      color: activa
                        ? theme.vars.palette.primary.darker
                        : theme.vars.palette.text.primary,
                      backgroundColor: activa
                        ? theme.vars.palette.primary.lighter
                        : theme.vars.palette.background.paper,
                      border: `2px solid ${
                        activa ? theme.vars.palette.primary.main : theme.vars.palette.divider
                      }`,
                      ...theme.applyStyles('dark', {
                        color: activa
                          ? theme.vars.palette.primary.lighter
                          : theme.vars.palette.text.primary,
                        backgroundColor: activa
                          ? theme.vars.palette.primary.darker
                          : theme.vars.palette.background.paper,
                        borderColor: activa
                          ? theme.vars.palette.primary.light
                          : theme.vars.palette.divider,
                      }),
                    })}
                  >
                    <ImagenDeCinta
                      cinta={cinta}
                      veces={configuracion?.veces}
                      efectoBorde={efectoBordeGlobal}
                      efectoNumero={efectoNumeroGlobal}
                      {...ajustesGlobales}
                    />
                    <Typography
                      variant="caption"
                      sx={{
                        mt: 0.5,
                        display: 'block',
                        lineHeight: 1.25,
                        whiteSpace: 'normal',
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {cinta.id}. {cinta.nombre}
                    </Typography>

                    {/* Cuántas veces se ganó. No propaga el clic: cambiar el número no
                    debe desmarcar la cinta. */}
                    {activa && (
                      <Box
                        onClick={(evento) => evento.stopPropagation()}
                        onKeyDown={(evento) => evento.stopPropagation()}
                        sx={{
                          mt: 0.5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <IconButton
                          size="small"
                          aria-label="Una vez menos"
                          disabled={configuracion.veces <= 1}
                          onClick={() => cambiarVeces(cinta.id, -1)}
                        >
                          <Iconify icon="mingcute:minimize-line" width={16} />
                        </IconButton>
                        <Typography variant="subtitle2" sx={{ minWidth: 40, textAlign: 'center' }}>
                          ×{configuracion.veces}
                        </Typography>
                        <IconButton
                          size="small"
                          aria-label="Una vez más"
                          disabled={configuracion.veces >= MAXIMO_VECES_CINTA}
                          onClick={() => cambiarVeces(cinta.id, 1)}
                        >
                          <Iconify icon="mingcute:add-line" width={16} />
                        </IconButton>
                      </Box>
                    )}
                  </Box>
                );
              })}
              {!cintasVisibles.length && (
                <Typography
                  variant="body2"
                  sx={{ py: 3, color: 'text.secondary', textAlign: 'center', gridColumn: '1 / -1' }}
                >
                  No encontramos cintas con esa búsqueda.
                </Typography>
              )}
            </Box>
          </>
        )}
      </DialogContent>

      <DialogActions>
        <Button
          onClick={() =>
            pestana === 'pines'
              ? setPinesElegidos(new Set())
              : pestana === 'medallas'
                ? setMedallasElegidas(new Set())
                : setElegidas(new Map())
          }
          disabled={guardando}
          color="inherit"
        >
          Quitar todas
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Button onClick={onClose} disabled={guardando} color="inherit">
          Cancelar
        </Button>
        <Button variant="contained" onClick={guardar} loading={guardando}>
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
